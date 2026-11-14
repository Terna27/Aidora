package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const maxChallengeAttempts = 5

var (
	ErrChallengeNotFound = errors.New(
		"verification challenge not found",
	)

	ErrChallengeConsumed = errors.New(
		"verification challenge has already been consumed",
	)

	ErrChallengeExpired = errors.New(
		"verification challenge has expired",
	)

	ErrChallengeAttemptsExceeded = errors.New(
		"verification challenge attempt limit exceeded",
	)

	ErrInvalidChallengeCode = errors.New(
		"invalid verification code",
	)

	ErrInvalidChallengeInput = errors.New(
		"invalid verification challenge input",
	)
)

// CreateChallengeInput contains the information needed to persist
// a verification challenge.
//
// CodeHash must contain an HMAC-SHA256 hash.
// Never pass or store the plaintext verification code.
type CreateChallengeInput struct {
	UserID      string
	Purpose     string
	Channel     string
	Destination string
	CodeHash    []byte
	ExpiresAt   time.Time
}

// HashVerificationCode calculates an HMAC-SHA256 hash of a verification
// code using the application challenge pepper.
//
// The pepper must come from AUTH_CHALLENGE_PEPPER.
func HashVerificationCode(
	code string,
	pepper []byte,
) ([]byte, error) {
	if strings.TrimSpace(code) == "" || len(pepper) < 32 {
		return nil, ErrInvalidChallengeInput
	}

	mac := hmac.New(sha256.New, pepper)
	_, _ = mac.Write([]byte(code))

	return mac.Sum(nil), nil
}

// CreateChallenge invalidates previous unconsumed challenges for the
// same user and purpose before inserting a new challenge.
//
// Both operations happen in one PostgreSQL transaction.
func (r *Repository) CreateChallenge(
	ctx context.Context,
	input CreateChallengeInput,
) error {
	if err := validateChallengeInput(input); err != nil {
		return err
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf(
			"begin challenge creation transaction: %w",
			err,
		)
	}
	defer tx.Rollback(ctx)

	// Lock the user first.
	// VerifyChallenge uses the same lock order to avoid deadlocks.
	var (
		userID      string
		email       *string
		phoneNumber *string
	)

	err = tx.QueryRow(
		ctx,
		`SELECT id, email, phone_number
		 FROM users
		 WHERE id = $1
		 FOR UPDATE`,
		input.UserID,
	).Scan(
		&userID,
		&email,
		&phoneNumber,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrUserNotFound
	}

	if err != nil {
		return fmt.Errorf("lock challenge user: %w", err)
	}

	// A user must only be able to verify an identity that belongs
	// to their account.
	if !challengeDestinationMatches(
		input.Channel,
		input.Destination,
		email,
		phoneNumber,
	) {
		return ErrInvalidChallengeInput
	}

	// Invalidate previous active challenges for this user and purpose.
	// This also invalidates challenges created through another channel
	// for the same purpose.
	_, err = tx.Exec(
		ctx,
		`UPDATE auth_verification_challenges
		 SET consumed_at = NOW()
		 WHERE user_id = $1
		   AND purpose = $2
		   AND consumed_at IS NULL`,
		input.UserID,
		input.Purpose,
	)

	if err != nil {
		return fmt.Errorf(
			"invalidate previous challenges: %w",
			err,
		)
	}

	// Insert the new challenge.
	_, err = tx.Exec(
		ctx,
		`INSERT INTO auth_verification_challenges (
			user_id,
			purpose,
			channel,
			destination,
			code_hash,
			expires_at
		)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		input.UserID,
		input.Purpose,
		input.Channel,
		input.Destination,
		input.CodeHash,
		input.ExpiresAt,
	)

	if err != nil {
		return fmt.Errorf(
			"insert verification challenge: %w",
			err,
		)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf(
			"commit challenge creation: %w",
			err,
		)
	}

	return nil
}

// VerifyChallenge verifies a candidate code hash against the latest
// challenge for the specified user, purpose, channel and destination.
//
// candidateHash must be generated using HashVerificationCode.
func (r *Repository) VerifyChallenge(
	ctx context.Context,
	userID string,
	purpose string,
	channel string,
	destination string,
	candidateHash []byte,
) error {
	if strings.TrimSpace(userID) == "" ||
		strings.TrimSpace(destination) == "" ||
		!validChallengePurpose(purpose) ||
		!validChallengeChannel(purpose, channel) ||
		len(candidateHash) != sha256.Size {
		return ErrInvalidChallengeInput
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf(
			"begin challenge verification transaction: %w",
			err,
		)
	}
	defer tx.Rollback(ctx)

	// Lock the user first.
	// This is the same lock order used by CreateChallenge.
	var (
		lockedUserID string
		email        *string
		phoneNumber  *string
	)

	err = tx.QueryRow(
		ctx,
		`SELECT id, email, phone_number
		 FROM users
		 WHERE id = $1
		 FOR UPDATE`,
		userID,
	).Scan(
		&lockedUserID,
		&email,
		&phoneNumber,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrUserNotFound
	}

	if err != nil {
		return fmt.Errorf(
			"lock verification user: %w",
			err,
		)
	}

	// Ensure the requested destination still belongs to this user.
	if !challengeDestinationMatches(
		channel,
		destination,
		email,
		phoneNumber,
	) {
		return ErrInvalidChallengeInput
	}

	var (
		challengeID string
		storedHash  []byte
		expiresAt   time.Time
		consumed    bool
		attempts    int
	)

	// Lock the latest matching challenge.
	// The user lock prevents a concurrent resend from replacing
	// the challenge while verification is taking place.
	err = tx.QueryRow(
		ctx,
		`SELECT
			id,
			code_hash,
			expires_at,
			(consumed_at IS NOT NULL),
			attempts
		 FROM auth_verification_challenges
		 WHERE user_id = $1
		   AND purpose = $2
		   AND channel = $3
		   AND destination = $4
		 ORDER BY created_at DESC, id DESC
		 LIMIT 1
		 FOR UPDATE`,
		userID,
		purpose,
		channel,
		destination,
	).Scan(
		&challengeID,
		&storedHash,
		&expiresAt,
		&consumed,
		&attempts,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrChallengeNotFound
	}

	if err != nil {
		return fmt.Errorf(
			"load verification challenge: %w",
			err,
		)
	}

	// Reject a challenge that has already been consumed.
	if consumed {
		return ErrChallengeConsumed
	}

	// Use the database clock for expiry checks.
	// This avoids relying on the application server's local clock.
	var expired bool

	err = tx.QueryRow(
		ctx,
		`SELECT $1 <= NOW()`,
		expiresAt,
	).Scan(&expired)

	if err != nil {
		return fmt.Errorf(
			"check challenge expiry: %w",
			err,
		)
	}

	if expired {
		_, err = tx.Exec(
			ctx,
			`UPDATE auth_verification_challenges
			 SET consumed_at = NOW()
			 WHERE id = $1
			   AND consumed_at IS NULL`,
			challengeID,
		)

		if err != nil {
			return fmt.Errorf(
				"consume expired challenge: %w",
				err,
			)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf(
				"commit expired challenge: %w",
				err,
			)
		}

		return ErrChallengeExpired
	}

	// Reject challenges that have already reached the attempt limit.
	if attempts >= maxChallengeAttempts {
		_, err = tx.Exec(
			ctx,
			`UPDATE auth_verification_challenges
			 SET consumed_at = NOW()
			 WHERE id = $1
			   AND consumed_at IS NULL`,
			challengeID,
		)

		if err != nil {
			return fmt.Errorf(
				"consume exhausted challenge: %w",
				err,
			)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf(
				"commit exhausted challenge: %w",
				err,
			)
		}

		return ErrChallengeAttemptsExceeded
	}

	// Compare hashes using a constant-time comparison.
	if len(storedHash) != sha256.Size ||
		!hmac.Equal(storedHash, candidateHash) {

		var newAttempts int

		err = tx.QueryRow(
			ctx,
			`UPDATE auth_verification_challenges
			 SET attempts = attempts + 1,
			     consumed_at = CASE
			         WHEN attempts + 1 >= $2
			         THEN NOW()
			         ELSE consumed_at
			     END
			 WHERE id = $1
			 RETURNING attempts`,
			challengeID,
			maxChallengeAttempts,
		).Scan(&newAttempts)

		if err != nil {
			return fmt.Errorf(
				"record failed verification attempt: %w",
				err,
			)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf(
				"commit failed verification attempt: %w",
				err,
			)
		}

		if newAttempts >= maxChallengeAttempts {
			return ErrChallengeAttemptsExceeded
		}

		return ErrInvalidChallengeCode
	}

	// The code is correct.
	// Consume the challenge before updating the user's identity.
	// Both operations are committed together.
	_, err = tx.Exec(
		ctx,
		`UPDATE auth_verification_challenges
		 SET consumed_at = NOW()
		 WHERE id = $1
		   AND consumed_at IS NULL`,
		challengeID,
	)

	if err != nil {
		return fmt.Errorf(
			"consume verification challenge: %w",
			err,
		)
	}

	// Only identity-verification purposes update verification timestamps.
	switch purpose {
	case "verify_email":
		_, err = tx.Exec(
			ctx,
			`UPDATE users
			 SET email_verified_at = NOW(),
			     updated_at = NOW()
			 WHERE id = $1`,
			userID,
		)

	case "verify_phone":
		_, err = tx.Exec(
			ctx,
			`UPDATE users
			 SET phone_verified_at = NOW(),
			     updated_at = NOW()
			 WHERE id = $1`,
			userID,
		)

	case "password_reset":
		// Password-reset challenge consumption is supported,
		// but changing the password belongs to the password-reset
		// workflow. No identity verification timestamp is changed.
	}

	if err != nil {
		return fmt.Errorf(
			"update user verification status: %w",
			err,
		)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf(
			"commit challenge verification: %w",
			err,
		)
	}

	return nil
}

// ResetPasswordWithChallenge consumes a password-reset challenge,
// changes the user's password, and revokes all existing sessions
// in one transaction.
func (r *Repository) ResetPasswordWithChallenge(
	ctx context.Context,
	userID string,
	purpose string,
	channel string,
	destination string,
	candidateHash []byte,
	newPasswordHash string,
) error {
	if strings.TrimSpace(userID) == "" ||
		purpose != "password_reset" ||
		!validChallengeChannel(purpose, channel) ||
		strings.TrimSpace(destination) == "" ||
		len(candidateHash) != sha256.Size ||
		strings.TrimSpace(newPasswordHash) == "" {
		return ErrInvalidChallengeInput
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin password reset transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Lock the user first. This preserves the lock order used by
	// challenge creation and verification.
	var email, phoneNumber *string

	err = tx.QueryRow(
		ctx,
		`
        SELECT email, phone_number
        FROM users
        WHERE id = $1
        FOR UPDATE
        `,
		userID,
	).Scan(&email, &phoneNumber)

	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrUserNotFound
		}

		return fmt.Errorf("lock password reset user: %w", err)
	}

	if !challengeDestinationMatches(
		channel,
		destination,
		email,
		phoneNumber,
	) {
		return ErrInvalidChallengeInput
	}

	// Lock the latest matching reset challenge.
	var (
		challengeID string
		storedHash  []byte
		consumedAt  *time.Time
		attempts    int
		expired     bool
	)

	err = tx.QueryRow(
		ctx,
		`
        SELECT
            id,
            code_hash,
            consumed_at,
            attempts,
            expires_at <= NOW()
        FROM auth_verification_challenges
        WHERE user_id = $1
          AND purpose = $2
          AND channel = $3
          AND destination = $4
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
        `,
		userID,
		purpose,
		channel,
		destination,
	).Scan(
		&challengeID,
		&storedHash,
		&consumedAt,
		&attempts,
		&expired,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrChallengeNotFound
		}

		return fmt.Errorf("load password reset challenge: %w", err)
	}

	if consumedAt != nil {
		return ErrChallengeConsumed
	}

	if expired {
		_, err = tx.Exec(
			ctx,
			`
            UPDATE auth_verification_challenges
            SET consumed_at = NOW()
            WHERE id = $1
            `,
			challengeID,
		)
		if err != nil {
			return fmt.Errorf("consume expired reset challenge: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit expired reset challenge: %w", err)
		}

		return ErrChallengeExpired
	}

	if attempts >= maxChallengeAttempts {
		_, err = tx.Exec(
			ctx,
			`
            UPDATE auth_verification_challenges
            SET consumed_at = NOW()
            WHERE id = $1
            `,
			challengeID,
		)
		if err != nil {
			return fmt.Errorf("consume exhausted reset challenge: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit exhausted reset challenge: %w", err)
		}

		return ErrChallengeAttemptsExceeded
	}

	if !hmac.Equal(storedHash, candidateHash) {
		_, err = tx.Exec(
			ctx,
			`
            UPDATE auth_verification_challenges
            SET
                attempts = attempts + 1,
                consumed_at = CASE
                    WHEN attempts + 1 >= $2 THEN NOW()
                    ELSE consumed_at
                END
            WHERE id = $1
            `,
			challengeID,
			maxChallengeAttempts,
		)
		if err != nil {
			return fmt.Errorf("record failed reset attempt: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit failed reset attempt: %w", err)
		}

		if attempts+1 >= maxChallengeAttempts {
			return ErrChallengeAttemptsExceeded
		}

		return ErrInvalidChallengeCode
	}

	// Consume the challenge.
	_, err = tx.Exec(
		ctx,
		`
        UPDATE auth_verification_challenges
        SET consumed_at = NOW()
        WHERE id = $1
        `,
		challengeID,
	)
	if err != nil {
		return fmt.Errorf("consume password reset challenge: %w", err)
	}

	// Change the password.
	_, err = tx.Exec(
		ctx,
		`
        UPDATE users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
		userID,
		newPasswordHash,
	)
	if err != nil {
		return fmt.Errorf("update password hash: %w", err)
	}

	// Revoke every session that has not already been revoked.
	_, err = tx.Exec(
		ctx,
		`
        UPDATE user_sessions
        SET revoked_at = NOW(),
            revoked_reason = 'password_reset'
        WHERE user_id = $1
          AND revoked_at IS NULL
        `,
		userID,
	)
	if err != nil {
		return fmt.Errorf("revoke user sessions after password reset: %w", err)
	}

	// Invalidate any other outstanding reset challenges.
	_, err = tx.Exec(
		ctx,
		`
        UPDATE auth_verification_challenges
        SET consumed_at = NOW()
        WHERE user_id = $1
          AND purpose = 'password_reset'
          AND consumed_at IS NULL
        `,
		userID,
	)
	if err != nil {
		return fmt.Errorf("invalidate remaining reset challenges: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit password reset: %w", err)
	}

	return nil
}

// validateChallengeInput validates a challenge before persistence.
func validateChallengeInput(
	input CreateChallengeInput,
) error {
	if strings.TrimSpace(input.UserID) == "" ||
		strings.TrimSpace(input.Destination) == "" ||
		len(input.CodeHash) != sha256.Size ||
		!input.ExpiresAt.After(time.Now()) ||
		!validChallengePurpose(input.Purpose) ||
		!validChallengeChannel(input.Purpose, input.Channel) {
		return ErrInvalidChallengeInput
	}

	return nil
}

// validChallengePurpose checks the allowed challenge purposes.
func validChallengePurpose(purpose string) bool {
	switch purpose {
	case "verify_email",
		"verify_phone",
		"password_reset":
		return true

	default:
		return false
	}
}

// validChallengeChannel checks the allowed delivery channels
// for each challenge purpose.
func validChallengeChannel(
	purpose string,
	channel string,
) bool {
	switch purpose {
	case "verify_email":
		return channel == "email"

	case "verify_phone":
		return channel == "phone"

	case "password_reset":
		return channel == "email" || channel == "phone"

	default:
		return false
	}
}

// challengeDestinationMatches ensures the destination being verified
// is the email address or phone number currently associated with the user.
func challengeDestinationMatches(
	channel string,
	destination string,
	email *string,
	phoneNumber *string,
) bool {
	switch channel {
	case "email":
		return email != nil &&
			strings.EqualFold(
				strings.TrimSpace(*email),
				strings.TrimSpace(destination),
			)

	case "phone":
		return phoneNumber != nil &&
			strings.TrimSpace(*phoneNumber) ==
				strings.TrimSpace(destination)

	default:
		return false
	}
}
