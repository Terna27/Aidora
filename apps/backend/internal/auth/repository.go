package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrEmailAlreadyExists  = errors.New("email already exists")
	ErrPhoneAlreadyExists  = errors.New("phone number already exists")
	ErrInvalidRole         = errors.New("invalid user role")
	ErrRoleAlreadyAssigned = errors.New("role already assigned to user")
	ErrInvalidUserID       = errors.New("invalid user ID")
)

type User struct {
	ID           string
	FullName     string
	Email        string
	PhoneNumber  string
	PasswordHash string
	Roles        []string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type CreateUserInput struct {
	FullName     string
	Email        string
	PhoneNumber  string
	PasswordHash string
	Role         string
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func validRole(role string) bool {
	switch role {
	case "patient", "responder", "admin":
		return true
	default:
		return false
	}
}

func (r *Repository) CreateUser(
	ctx context.Context,
	input CreateUserInput,
) (User, error) {
	fullName := strings.TrimSpace(input.FullName)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	passwordHash := strings.TrimSpace(input.PasswordHash)

	// Validate required fields.
	if fullName == "" {
		return User{}, errors.New("full name is required")
	}

	// At least one login identifier must be provided.
	if email == "" && phoneNumber == "" {
		return User{}, errors.New("email or phone number is required")
	}

	if passwordHash == "" {
		return User{}, errors.New("password hash is required")
	}

	if !validRole(input.Role) {
		return User{}, ErrInvalidRole
	}

	// Use nil for missing identifiers so PostgreSQL stores NULL.
	var emailValue any
	if email != "" {
		emailValue = email
	}

	var phoneValue any
	if phoneNumber != "" {
		phoneValue = phoneNumber
	}

	// Create the user and assign the initial role atomically.
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return User{}, fmt.Errorf(
			"begin create user transaction: %w",
			err,
		)
	}

	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var user User

	err = tx.QueryRow(ctx, `
		INSERT INTO users (
			full_name,
			email,
			phone_number,
			password_hash
		)
		VALUES ($1, $2, $3, $4)
		RETURNING
			id::text,
			full_name,
			COALESCE(email, ''),
			COALESCE(phone_number, ''),
			password_hash,
			created_at,
			updated_at
	`,
		fullName,
		emailValue,
		phoneValue,
		passwordHash,
	).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.PhoneNumber,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return User{}, mapUserDatabaseError(err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		VALUES ($1, $2)
	`, user.ID, input.Role)
	if err != nil {
		return User{}, fmt.Errorf(
			"assign initial user role: %w",
			err,
		)
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf(
			"commit create user transaction: %w",
			err,
		)
	}

	user.Roles = []string{input.Role}

	return user, nil
}

func (r *Repository) GetUserByID(
	ctx context.Context,
	userID string,
) (User, error) {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return User{}, ErrInvalidUserID
	}

	return r.getUser(ctx, `
        WHERE u.id = $1
    `, parsedID)
}

func (r *Repository) GetUserByEmail(
	ctx context.Context,
	email string,
) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	if email == "" {
		return User{}, errors.New("email is required")
	}

	return r.getUser(ctx, `
        WHERE LOWER(u.email) = $1
    `, email)
}

func (r *Repository) GetUserByPhoneNumber(
	ctx context.Context,
	phoneNumber string,
) (User, error) {
	phoneNumber = strings.TrimSpace(phoneNumber)

	if phoneNumber == "" {
		return User{}, errors.New("phone number is required")
	}

	return r.getUser(ctx, `
        WHERE u.phone_number = $1
    `, phoneNumber)
}

func (r *Repository) getUser(
	ctx context.Context,
	condition string,
	value any,
) (User, error) {
	query := `
		SELECT
			u.id::text,
			u.full_name,
			COALESCE(u.email, ''),
			COALESCE(u.phone_number, ''),
			u.password_hash,
			u.created_at,
			u.updated_at,
			COALESCE(
				array_agg(ur.role::text)
					FILTER (WHERE ur.role IS NOT NULL),
				ARRAY[]::text[]
			)
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		` + condition + `
		GROUP BY u.id
	`

	var user User

	err := r.pool.QueryRow(ctx, query, value).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.PhoneNumber,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.Roles,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("get user: %w", err)
	}

	return user, nil
}

func mapUserDatabaseError(err error) error {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "users_email_key", "users_email_lower_unique":
			return ErrEmailAlreadyExists

		case "users_phone_number_key":
			return ErrPhoneAlreadyExists
		}
	}

	return fmt.Errorf("create user: %w", err)
}

func (r *Repository) AddRole(
	ctx context.Context,
	userID string,
	role string,
) error {
	if !validRole(role) {
		return ErrInvalidRole
	}

	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return ErrInvalidUserID
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		VALUES ($1, $2)
	`, parsedID, role)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) {
			switch {
			case pgErr.Code == "23505" &&
				pgErr.ConstraintName == "user_roles_pkey":
				return ErrRoleAlreadyAssigned

			case pgErr.Code == "23503":
				return ErrUserNotFound
			}
		}

		return fmt.Errorf("add user role: %w", err)
	}

	return nil
}
