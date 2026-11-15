package responder

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound         = errors.New("user not found")
	ErrPatientRoleRequired  = errors.New("patient role required")
	ErrAlreadyApplied       = errors.New("responder application already exists")
	ErrInvalidResponderType = errors.New("one or more responder types are invalid")
	ErrInvalidApplication   = errors.New("invalid responder application")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type ApplicationResult struct {
	UserID       string    `json:"userId"`
	TypeCodes    []string  `json:"responderTypes"`
	Verification string    `json:"verificationStatus"`
	Availability string    `json:"availabilityStatus"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Apply creates a responder profile, attaches its capabilities and assigns
// the responder role atomically. The existing patient role is retained.
func (repo *Repository) Apply(
	ctx context.Context,
	userID string,
	typeCodes []string,
	description *string,
) (ApplicationResult, error) {
	if userID == "" || len(typeCodes) == 0 {
		return ApplicationResult{}, ErrInvalidApplication
	}

	// Reject empty or duplicate type codes before opening a transaction.
	seen := make(map[string]struct{}, len(typeCodes))
	for _, code := range typeCodes {
		code = strings.TrimSpace(code)
		if code == "" {
			return ApplicationResult{}, ErrInvalidApplication
		}
		if _, exists := seen[code]; exists {
			return ApplicationResult{}, ErrInvalidApplication
		}
		seen[code] = struct{}{}
	}

	tx, err := repo.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return ApplicationResult{}, fmt.Errorf("begin responder application: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Lock the user row to serialize concurrent applications for this user.
	var lockedUserID string
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM users
		WHERE id = $1
		FOR UPDATE
	`, userID).Scan(&lockedUserID)

	if errors.Is(err, pgx.ErrNoRows) {
		return ApplicationResult{}, ErrUserNotFound
	}
	if err != nil {
		return ApplicationResult{}, fmt.Errorf("lock applicant account: %w", err)
	}

	// Applications are made from an existing patient account.
	var isPatient bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM user_roles
			WHERE user_id = $1
			  AND role = 'patient'
		)
	`, userID).Scan(&isPatient)

	if err != nil {
		return ApplicationResult{}, fmt.Errorf("check patient role: %w", err)
	}
	if !isPatient {
		return ApplicationResult{}, ErrPatientRoleRequired
	}

	var profileExists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM responder_profiles
			WHERE user_id = $1
		)
	`, userID).Scan(&profileExists)

	if err != nil {
		return ApplicationResult{}, fmt.Errorf("check existing responder profile: %w", err)
	}
	if profileExists {
		return ApplicationResult{}, ErrAlreadyApplied
	}

	// Validate all requested responder types before creating the profile.
	var validTypeCount int
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM responder_types
		WHERE code = ANY($1::text[])
		  AND is_active = TRUE
	`, typeCodes).Scan(&validTypeCount)

	if err != nil {
		return ApplicationResult{}, fmt.Errorf("validate responder types: %w", err)
	}
	if validTypeCount != len(typeCodes) {
		return ApplicationResult{}, ErrInvalidResponderType
	}

	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO responder_profiles (
			user_id,
			service_description
		)
		VALUES ($1, $2)
		RETURNING created_at
	`, userID, description).Scan(&createdAt)

	if err != nil {
		return ApplicationResult{}, fmt.Errorf("create responder profile: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO responder_profile_types (
			responder_user_id,
			responder_type_id
		)
		SELECT $1, id
		FROM responder_types
		WHERE code = ANY($2::text[])
		  AND is_active = TRUE
	`, userID, typeCodes)

	if err != nil {
		return ApplicationResult{}, fmt.Errorf("attach responder types: %w", err)
	}

	// Preserve the patient's existing role and add responder.
	_, err = tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		VALUES ($1, 'responder')
		ON CONFLICT (user_id, role) DO NOTHING
	`, userID)

	if err != nil {
		return ApplicationResult{}, fmt.Errorf("assign responder role: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return ApplicationResult{}, fmt.Errorf("commit responder application: %w", err)
	}

	return ApplicationResult{
		UserID:       userID,
		TypeCodes:    typeCodes,
		Verification: "pending",
		Availability: "offline",
		CreatedAt:    createdAt,
	}, nil
}
