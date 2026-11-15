package location

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrEmergencyNotFound    = errors.New("emergency not found")
	ErrLocationAccessDenied = errors.New("location update not authorized")
)

// Repository persists emergency location updates.
type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// SavePatientLocation records a GPS update from the patient who owns the
// emergency. The patient identity comes from the authenticated request.
func (repo *Repository) SavePatientLocation(
	ctx context.Context,
	emergencyID string,
	patientID string,
	update LocationUpdate,
) (Location, error) {
	if err := ValidateLocationUpdate(update); err != nil {
		return Location{}, err
	}

	row := repo.pool.QueryRow(ctx, `
		INSERT INTO emergency_locations (
			emergency_id,
			location_type,
			patient_id,
			location,
			latitude,
			longitude,
			accuracy_meters,
			recorded_at
		)
		SELECT
			e.id,
			'PATIENT',
			e.patient_id,
			ST_SetSRID(
				ST_MakePoint($4, $3),
				4326
			)::geography,
			$3,
			$4,
			$5,
			$6
		FROM emergencies e
		WHERE e.id = $1
		  AND e.patient_id = $2
		RETURNING
			id::text,
			emergency_id::text,
			location_type,
			latitude,
			longitude,
			accuracy_meters,
			recorded_at,
			received_at
	`,
		emergencyID,
		patientID,
		update.Latitude,
		update.Longitude,
		update.AccuracyMeters,
		update.RecordedAt,
	)

	location, err := scanLocation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Location{}, ErrLocationAccessDenied
	}
	if err != nil {
		return Location{}, fmt.Errorf("save patient location: %w", err)
	}

	return location, nil
}

// SaveResponderLocation records a GPS update from the responder who currently
// has an active assignment to the emergency.
func (repo *Repository) SaveResponderLocation(
	ctx context.Context,
	emergencyID string,
	responderID string,
	update LocationUpdate,
) (Location, error) {
	if err := ValidateLocationUpdate(update); err != nil {
		return Location{}, err
	}

	if err := ValidateRecordedAtFutureSkew(update.RecordedAt, time.Now()); err != nil {
		return Location{}, err
	}

	if err := ValidateRecordedAtFutureSkew(update.RecordedAt, time.Now()); err != nil {
		return Location{}, err
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return Location{}, fmt.Errorf("begin responder location transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Lock the active assignment so it cannot end while this update is saved.
	var assignmentID string

	err = tx.QueryRow(ctx, `
		SELECT id::text
		FROM emergency_responder_assignments
		WHERE emergency_id = $1
		  AND responder_id = $2
		  AND ended_at IS NULL
		FOR SHARE
	`, emergencyID, responderID).Scan(&assignmentID)

	if errors.Is(err, pgx.ErrNoRows) {
		return Location{}, ErrLocationAccessDenied
	}
	if err != nil {
		return Location{}, fmt.Errorf("verify responder assignment: %w", err)
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO emergency_locations (
			emergency_id,
			location_type,
			responder_assignment_id,
			location,
			latitude,
			longitude,
			accuracy_meters,
			recorded_at
		)
		VALUES (
			$1,
			'RESPONDER',
			$2,
			ST_SetSRID(
				ST_MakePoint($4, $3),
				4326
			)::geography,
			$3,
			$4,
			$5,
			$6
		)
		RETURNING
			id::text,
			emergency_id::text,
			location_type,
			latitude,
			longitude,
			accuracy_meters,
			recorded_at,
			received_at
	`,
		emergencyID,
		assignmentID,
		update.Latitude,
		update.Longitude,
		update.AccuracyMeters,
		update.RecordedAt,
	)

	location, err := scanLocation(row)
	if err != nil {
		return Location{}, fmt.Errorf("save responder location: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Location{}, fmt.Errorf("commit responder location: %w", err)
	}

	return location, nil
}

// LatestForEmergency returns the latest patient and responder positions.
// Server receipt time, not the device timestamp, determines which update
// is latest.
func (repo *Repository) LatestForEmergency(
	ctx context.Context,
	emergencyID string,
) (LocationSnapshot, error) {
	var exists bool

	err := repo.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM emergencies
			WHERE id = $1
		)
	`, emergencyID).Scan(&exists)

	if err != nil {
		return LocationSnapshot{}, fmt.Errorf("check emergency for location snapshot: %w", err)
	}

	if !exists {
		return LocationSnapshot{}, ErrEmergencyNotFound
	}

	snapshot := LocationSnapshot{
		EmergencyID: emergencyID,
	}

	patient, err := repo.latestByType(ctx, emergencyID, LocationTypePatient)
	if err != nil {
		return LocationSnapshot{}, err
	}
	snapshot.Patient = patient

	responder, err := repo.latestByType(ctx, emergencyID, LocationTypeResponder)
	if err != nil {
		return LocationSnapshot{}, err
	}
	snapshot.Responder = responder

	return snapshot, nil
}

func (repo *Repository) latestByType(
	ctx context.Context,
	emergencyID string,
	locationType LocationType,
) (*Location, error) {
	row := repo.pool.QueryRow(ctx, `
		SELECT
			id::text,
			emergency_id::text,
			location_type,
			latitude,
			longitude,
			accuracy_meters,
			recorded_at,
			received_at
		FROM emergency_locations
		WHERE emergency_id = $1
		  AND location_type = $2
		ORDER BY received_at DESC, id DESC
		LIMIT 1
	`, emergencyID, locationType)

	location, err := scanLocation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("retrieve latest %s location: %w", locationType, err)
	}

	return &location, nil
}

func scanLocation(row pgx.Row) (Location, error) {
	var location Location

	err := row.Scan(
		&location.ID,
		&location.EmergencyID,
		&location.Type,
		&location.Latitude,
		&location.Longitude,
		&location.AccuracyMeters,
		&location.RecordedAt,
		&location.ReceivedAt,
	)

	return location, err
}

// LatestForEmergencyForUser returns the latest positions only when the
// requester owns the emergency or has an active responder assignment.
func (repo *Repository) LatestForEmergencyForUser(
    ctx context.Context,
    emergencyID string,
    requesterID string,
) (LocationSnapshot, error) {
    var exists bool
    var authorized bool

    err := repo.pool.QueryRow(ctx, `
        SELECT
            EXISTS (
                SELECT 1
                FROM emergencies
                WHERE id = $1
            ),
            EXISTS (
                SELECT 1
                FROM emergencies e
                WHERE e.id = $1
                  AND (
                      e.patient_id = $2
                      OR EXISTS (
                          SELECT 1
                          FROM emergency_responder_assignments a
                          WHERE a.emergency_id = e.id
                            AND a.responder_id = $2
                            AND a.ended_at IS NULL
                      )
                  )
            )
    `, emergencyID, requesterID).Scan(&exists, &authorized)

    if err != nil {
        return LocationSnapshot{}, fmt.Errorf(
            "authorize emergency location snapshot: %w",
            err,
        )
    }

    if !exists {
        return LocationSnapshot{}, ErrEmergencyNotFound
    }

    if !authorized {
        return LocationSnapshot{}, ErrLocationAccessDenied
    }

    return repo.LatestForEmergency(ctx, emergencyID)
}
