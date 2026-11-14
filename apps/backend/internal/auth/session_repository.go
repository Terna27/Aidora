package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrSessionNotFound   = errors.New("session not found")
	ErrSessionExpired    = errors.New("session has expired")
	ErrSessionRevoked    = errors.New("session has been revoked")
	ErrRefreshTokenReuse = errors.New("refresh token reuse detected")
	ErrInvalidSession    = errors.New("invalid session input")
)

// Session contains persisted session metadata.
// It deliberately does not contain the refresh-token hash.
type Session struct {
	ID        string
	UserID    string
	FamilyID  string
	ExpiresAt time.Time
	CreatedAt time.Time
}

// CreateSessionInput contains the data required to create a session.
// RefreshTokenHash must be a SHA-256 hash, never the raw token.
type CreateSessionInput struct {
	UserID           string
	FamilyID         string
	RefreshTokenHash []byte
	ExpiresAt        time.Time
}

// CreateSession persists a new refresh-token session.
func (r *Repository) CreateSession(
	ctx context.Context,
	input CreateSessionInput,
) (Session, error) {
	if r == nil || r.pool == nil {
		return Session{}, fmt.Errorf("%w: repository is not initialized", ErrInvalidSession)
	}

	if strings.TrimSpace(input.UserID) == "" ||
		strings.TrimSpace(input.FamilyID) == "" ||
		len(input.RefreshTokenHash) != 32 ||
		!input.ExpiresAt.After(time.Now()) {
		return Session{}, ErrInvalidSession
	}

	var session Session

	err := r.pool.QueryRow(
		ctx,
		`
		INSERT INTO user_sessions (
			user_id,
			family_id,
			refresh_token_hash,
			expires_at
		)
		VALUES ($1, $2, $3, $4)
		RETURNING
			id::text,
			user_id::text,
			family_id::text,
			expires_at,
			created_at
		`,
		input.UserID,
		input.FamilyID,
		input.RefreshTokenHash,
		input.ExpiresAt,
	).Scan(
		&session.ID,
		&session.UserID,
		&session.FamilyID,
		&session.ExpiresAt,
		&session.CreatedAt,
	)
	if err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}

	return session, nil
}

// RotateSession atomically revokes an existing refresh-token session
// and creates its replacement.
//
// If a previously rotated token is presented again, all active sessions
// belonging to its family are revoked.
func (r *Repository) RotateSession(
	ctx context.Context,
	oldRefreshTokenHash []byte,
	newRefreshTokenHash []byte,
	newExpiresAt time.Time,
) (Session, error) {
	if r == nil || r.pool == nil {
		return Session{}, fmt.Errorf("%w: repository is not initialized", ErrInvalidSession)
	}

	if len(oldRefreshTokenHash) != 32 ||
		len(newRefreshTokenHash) != 32 ||
		newExpiresAt.IsZero() {
		return Session{}, ErrInvalidSession
	}

	if string(oldRefreshTokenHash) == string(newRefreshTokenHash) {
		return Session{}, fmt.Errorf("%w: replacement token hash must be different", ErrInvalidSession)
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Session{}, fmt.Errorf("begin session rotation: %w", err)
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var (
		oldSessionID  string
		userID        string
		familyID      string
		expiresAt     time.Time
		revokedAt     *time.Time
		revokedReason string
	)

	err = tx.QueryRow(
		ctx,
		`
		SELECT
			id::text,
			user_id::text,
			family_id::text,
			expires_at,
			revoked_at,
			COALESCE(revoked_reason, '')
		FROM user_sessions
		WHERE refresh_token_hash = $1
		FOR UPDATE
		`,
		oldRefreshTokenHash,
	).Scan(
		&oldSessionID,
		&userID,
		&familyID,
		&expiresAt,
		&revokedAt,
		&revokedReason,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrSessionNotFound
	}
	if err != nil {
		return Session{}, fmt.Errorf("find session for rotation: %w", err)
	}

	// A token previously revoked because it was rotated has been reused.
	// Revoke every still-active session in the same family.
	if revokedAt != nil {
		if revokedReason == "rotated" {
			_, err = tx.Exec(
				ctx,
				`
				UPDATE user_sessions
				SET revoked_at = NOW(),
				    revoked_reason = 'reuse_detected'
				WHERE family_id = $1
				  AND revoked_at IS NULL
				`,
				familyID,
			)
			if err != nil {
				return Session{}, fmt.Errorf("revoke session family after token reuse: %w", err)
			}

			if err := tx.Commit(ctx); err != nil {
				return Session{}, fmt.Errorf("commit token reuse response: %w", err)
			}

			return Session{}, ErrRefreshTokenReuse
		}

		return Session{}, ErrSessionRevoked
	}

	// Use PostgreSQL's clock for expiry decisions.
	var databaseNow time.Time
	if err := tx.QueryRow(ctx, `SELECT NOW()`).Scan(&databaseNow); err != nil {
		return Session{}, fmt.Errorf("read database time: %w", err)
	}

	if !expiresAt.After(databaseNow) {
		_, err = tx.Exec(
			ctx,
			`
			UPDATE user_sessions
			SET revoked_at = NOW(),
			    revoked_reason = 'expired'
			WHERE id = $1
			  AND revoked_at IS NULL
			`,
			oldSessionID,
		)
		if err != nil {
			return Session{}, fmt.Errorf("mark expired session: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return Session{}, fmt.Errorf("commit expired session: %w", err)
		}

		return Session{}, ErrSessionExpired
	}

	if !newExpiresAt.After(databaseNow) {
		return Session{}, ErrInvalidSession
	}

	// Insert the replacement first so the old session can reference it.
	var newSession Session

	err = tx.QueryRow(
		ctx,
		`
		INSERT INTO user_sessions (
			user_id,
			family_id,
			refresh_token_hash,
			expires_at
		)
		VALUES ($1, $2, $3, $4)
		RETURNING
			id::text,
			user_id::text,
			family_id::text,
			expires_at,
			created_at
		`,
		userID,
		familyID,
		newRefreshTokenHash,
		newExpiresAt,
	).Scan(
		&newSession.ID,
		&newSession.UserID,
		&newSession.FamilyID,
		&newSession.ExpiresAt,
		&newSession.CreatedAt,
	)
	if err != nil {
		return Session{}, fmt.Errorf("create replacement session: %w", err)
	}

	// Revoke the old session and link it to the replacement.
	commandTag, err := tx.Exec(
		ctx,
		`
		UPDATE user_sessions
		SET revoked_at = $1,
		    revoked_reason = 'rotated',
		    replaced_by_session_id = $2,
		    last_used_at = $1
		WHERE id = $3
		  AND revoked_at IS NULL
		`,
		databaseNow,
		newSession.ID,
		oldSessionID,
	)
	if err != nil {
		return Session{}, fmt.Errorf("revoke old session: %w", err)
	}

	if commandTag.RowsAffected() != 1 {
		return Session{}, fmt.Errorf("revoke old session: expected one affected row, got %d", commandTag.RowsAffected())
	}

	if err := tx.Commit(ctx); err != nil {
		return Session{}, fmt.Errorf("commit session rotation: %w", err)
	}

	return newSession, nil
}

// RevokeSession revokes an active session during logout.
// Repeated logout requests are treated as successful.
func (r *Repository) RevokeSession(
	ctx context.Context,
	refreshTokenHash []byte,
) error {
	if r == nil || r.pool == nil {
		return fmt.Errorf("%w: repository is not initialized", ErrInvalidSession)
	}

	if len(refreshTokenHash) != 32 {
		return ErrInvalidSession
	}

	commandTag, err := r.pool.Exec(
		ctx,
		`
		UPDATE user_sessions
		SET revoked_at = NOW(),
		    revoked_reason = 'logout'
		WHERE refresh_token_hash = $1
		  AND revoked_at IS NULL
		`,
		refreshTokenHash,
	)
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}

	if commandTag.RowsAffected() == 1 {
		return nil
	}

	// Distinguish an already-revoked session from an unknown token.
	var exists bool
	err = r.pool.QueryRow(
		ctx,
		`
		SELECT EXISTS (
			SELECT 1
			FROM user_sessions
			WHERE refresh_token_hash = $1
		)
		`,
		refreshTokenHash,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check session during revocation: %w", err)
	}

	if !exists {
		return ErrSessionNotFound
	}

	return nil
}
