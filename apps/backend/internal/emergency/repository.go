package emergency

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrPatientRoleRequired = errors.New("patient role required")
	ErrActiveEmergency     = errors.New("patient already has an active emergency")
	ErrIdempotencyConflict = errors.New("idempotency key was used with a different payload")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type CreateResult struct {
	Data     json.RawMessage
	Status   int
	Replayed bool
}

type createResponseData struct {
	ID             string         `json:"id"`
	State          State          `json:"state"`
	LocationSource LocationSource `json:"locationSource"`
	CreatedAt      time.Time      `json:"createdAt"`
}

func (repo *Repository) Create(
	ctx context.Context,
	patientID string,
	idempotencyKey string,
	requestHash []byte,
	emergency Emergency,
) (CreateResult, error) {
	tx, err := repo.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CreateResult{}, fmt.Errorf("begin emergency transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Confirm that the authenticated user has the patient role.
	var isPatient bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM user_roles
			WHERE user_id = $1
			  AND role = 'patient'
		)
	`, patientID).Scan(&isPatient)

	if err != nil {
		return CreateResult{}, fmt.Errorf("verify patient role: %w", err)
	}

	if !isPatient {
		return CreateResult{}, ErrPatientRoleRequired
	}

	// Serialize requests using the same patient and idempotency key.
	lockKey := patientID + ":" + idempotencyKey

	_, err = tx.Exec(ctx, `
		SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
	`, lockKey)

	if err != nil {
		return CreateResult{}, fmt.Errorf("acquire idempotency lock: %w", err)
	}

	// Check whether this key has already been used.
	var (
		existingHash   []byte
		existingData   []byte
		existingStatus int
		isExpired      bool
	)

	err = tx.QueryRow(ctx, `
		SELECT
			request_hash,
			response_body,
			response_status,
			expires_at <= clock_timestamp()
		FROM emergency_idempotency_keys
		WHERE patient_id = $1
		AND idempotency_key = $2
	`, patientID, idempotencyKey).Scan(
		&existingHash,
		&existingData,
		&existingStatus,
		&isExpired,
	)

	if err == nil {
		if !isExpired {
			if string(existingHash) != string(requestHash) {
				return CreateResult{}, ErrIdempotencyConflict
			}

			if err := tx.Commit(ctx); err != nil {
				return CreateResult{}, fmt.Errorf("commit idempotent replay: %w", err)
			}

			return CreateResult{
				Data:     json.RawMessage(existingData),
				Status:   existingStatus,
				Replayed: true,
			}, nil
		}

		// Expired key: allow it to be used again.
		_, err = tx.Exec(ctx, `
			DELETE FROM emergency_idempotency_keys
			WHERE patient_id = $1
			  AND idempotency_key = $2
		`, patientID, idempotencyKey)

		if err != nil {
			return CreateResult{}, fmt.Errorf("remove expired idempotency key: %w", err)
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return CreateResult{}, fmt.Errorf("check idempotency key: %w", err)
	}

	// Check for an existing active emergency.
	var hasActiveEmergency bool

	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM emergencies
			WHERE patient_id = $1
			  AND current_state NOT IN ('COMPLETED', 'CANCELLED')
		)
	`, patientID).Scan(&hasActiveEmergency)

	if err != nil {
		return CreateResult{}, fmt.Errorf("check active emergency: %w", err)
	}

	if hasActiveEmergency {
		return CreateResult{}, ErrActiveEmergency
	}

	// Insert the emergency in its initial state.
	var emergencyID string
	var createdAt time.Time

	err = tx.QueryRow(ctx, `
		INSERT INTO emergencies (
			patient_id,
			current_state,
			location_source,
			location,
			latitude,
			longitude,
			accuracy_meters,
			accuracy_level,
			village_community,
			landmark,
			street_address,
			directions_notes,
			patient_notes
		)
		VALUES (
			$1, 'CREATED', $2,
			CASE
				    WHEN $2::varchar = 'GPS'
				THEN ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
				ELSE NULL
			END,
			$3, $4, $5, $6, $7, $8, $9, $10, $11
		)
		RETURNING id, created_at
	`,
		patientID,
		emergency.LocationSource,
		emergency.Latitude,
		emergency.Longitude,
		emergency.AccuracyMeters,
		emergency.AccuracyLevel,
		emergency.VillageCommunity,
		emergency.Landmark,
		emergency.StreetAddress,
		emergency.DirectionsNotes,
		emergency.PatientNotes,
	).Scan(&emergencyID, &createdAt)

	if err != nil {
		return CreateResult{}, handleCreateError(err)
	}

	// Record the initial state transition.
	_, err = tx.Exec(ctx, `
		INSERT INTO emergency_state_history (
			emergency_id,
			previous_state,
			new_state,
			actor_type,
			actor_user_id
		)
		VALUES ($1, NULL, 'CREATED', 'PATIENT', $2)
	`, emergencyID, patientID)

	if err != nil {
		return CreateResult{}, fmt.Errorf("record initial emergency history: %w", err)
	}

	// Start dispatching.
	_, err = tx.Exec(ctx, `
		UPDATE emergencies
		SET current_state = 'DISPATCHING',
		    updated_at = clock_timestamp()
		WHERE id = $1
	`, emergencyID)

	if err != nil {
		return CreateResult{}, fmt.Errorf("start emergency dispatch: %w", err)
	}

	// Record the dispatch transition.
	_, err = tx.Exec(ctx, `
		INSERT INTO emergency_state_history (
			emergency_id,
			previous_state,
			new_state,
			actor_type
		)
		VALUES ($1, 'CREATED', 'DISPATCHING', 'SYSTEM')
	`, emergencyID)

	if err != nil {
		return CreateResult{}, fmt.Errorf("record dispatch history: %w", err)
	}

	// Build the response data that will be saved for idempotent retries.
	responseData := createResponseData{
		ID:             emergencyID,
		State:          StateDispatching,
		LocationSource: emergency.LocationSource,
		CreatedAt:      createdAt,
	}

	responseBody, err := json.Marshal(responseData)
	if err != nil {
		return CreateResult{}, fmt.Errorf("marshal emergency response: %w", err)
	}

	// Save the idempotency record in the same transaction.
	_, err = tx.Exec(ctx, `
		INSERT INTO emergency_idempotency_keys (
			patient_id,
			idempotency_key,
			request_hash,
			emergency_id,
			response_status,
			response_body,
			expires_at
		)
		VALUES (
			$1, $2, $3, $4, 202, $5::jsonb,
			clock_timestamp() + INTERVAL '24 hours'
		)
	`,
		patientID,
		idempotencyKey,
		requestHash,
		emergencyID,
		responseBody,
	)

	if err != nil {
		return CreateResult{}, fmt.Errorf("save idempotency record: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return CreateResult{}, fmt.Errorf("commit emergency creation: %w", err)
	}

	return CreateResult{
		Data:   responseBody,
		Status: 202,
	}, nil
}

func handleCreateError(err error) error {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) &&
		pgErr.Code == "23505" &&
		pgErr.ConstraintName == "emergencies_one_active_per_patient_idx" {
		return ErrActiveEmergency
	}

	return fmt.Errorf("insert emergency: %w", err)
}
