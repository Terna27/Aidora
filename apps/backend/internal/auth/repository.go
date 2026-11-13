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
	if strings.TrimSpace(input.FullName) == "" {
		return User{}, errors.New("full name is required")
	}
	if strings.TrimSpace(input.Email) == "" {
		return User{}, errors.New("email is required")
	}
	if strings.TrimSpace(input.PhoneNumber) == "" {
		return User{}, errors.New("phone number is required")
	}
	if strings.TrimSpace(input.PasswordHash) == "" {
		return User{}, errors.New("password hash is required")
	}
	if !validRole(input.Role) {
		return User{}, ErrInvalidRole
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return User{}, fmt.Errorf("begin create user transaction: %w", err)
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
			email,
			phone_number,
			password_hash,
			created_at,
			updated_at
	`,
		input.FullName,
		input.Email,
		input.PhoneNumber,
		input.PasswordHash,
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
		return User{}, fmt.Errorf("assign initial user role: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit create user transaction: %w", err)
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
	return r.getUser(ctx, `
		WHERE u.email = $1
	`, email)
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
			u.email,
			u.phone_number,
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
		case "users_email_key":
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
