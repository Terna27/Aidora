package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

var challengeTestPepper = []byte(
	"test-only-challenge-pepper-32-bytes",
)

func newChallengeTestUser(
	t *testing.T,
	repo *Repository,
) User {
	t.Helper()

	return createAuthTestUser(t, repo, "patient")
}

func createTestChallenge(
	t *testing.T,
	repo *Repository,
	user User,
	code string,
	expiresAt time.Time,
) []byte {
	t.Helper()

	hash, err := HashVerificationCode(
		code,
		challengeTestPepper,
	)
	if err != nil {
		t.Fatalf("hash challenge code: %v", err)
	}

	_, err = repo.CreateChallenge(
		context.Background(),
		CreateChallengeInput{
			UserID:      user.ID,
			Purpose:     "verify_email",
			Channel:     "email",
			Destination: user.Email,
			CodeHash:    hash,
			ExpiresAt:   expiresAt,
		},
	)
	if err != nil {
		t.Fatalf("create challenge: %v", err)
	}

	return hash
}

func createPasswordResetTestChallenge(
	t *testing.T,
	repo *Repository,
	user User,
	code string,
	expiresAt time.Time,
) []byte {
	t.Helper()

	hash := candidateChallengeHash(t, code)

	_, err := repo.CreateChallenge(context.Background(), CreateChallengeInput{
		UserID:      user.ID,
		Purpose:     "password_reset",
		Channel:     "email",
		Destination: user.Email,
		CodeHash:    hash,
		ExpiresAt:   expiresAt,
	})
	if err != nil {
		t.Fatalf("create password reset challenge: %v", err)
	}

	return hash
}

func candidateChallengeHash(t *testing.T, code string) []byte {
	t.Helper()

	hash, err := HashVerificationCode(
		code,
		challengeTestPepper,
	)
	if err != nil {
		t.Fatalf("hash candidate code: %v", err)
	}

	return hash
}

func verifyTestChallenge(
	repo *Repository,
	user User,
	hash []byte,
) error {
	return repo.VerifyChallenge(
		context.Background(),
		user.ID,
		"verify_email",
		"email",
		user.Email,
		hash,
	)
}

func TestCreateChallenge(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	var count int

	err := pool.QueryRow(
		context.Background(),
		`SELECT COUNT(*)
		 FROM auth_verification_challenges
		 WHERE user_id = $1
		   AND purpose = 'verify_email'
		   AND channel = 'email'`,
		user.ID,
	).Scan(&count)

	if err != nil {
		t.Fatalf("count challenges: %v", err)
	}

	if count != 1 {
		t.Fatalf("expected 1 challenge, got %d", count)
	}
}

func TestCreateChallenge_InvalidatesPreviousChallenge(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"111111",
		time.Now().Add(10*time.Minute),
	)

	createTestChallenge(
		t,
		repo,
		user,
		"222222",
		time.Now().Add(10*time.Minute),
	)

	var (
		total    int
		active   int
		consumed int
	)

	err := pool.QueryRow(
		context.Background(),
		`SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE consumed_at IS NULL),
			COUNT(*) FILTER (WHERE consumed_at IS NOT NULL)
		 FROM auth_verification_challenges
		 WHERE user_id = $1
		   AND purpose = 'verify_email'`,
		user.ID,
	).Scan(&total, &active, &consumed)

	if err != nil {
		t.Fatalf("count challenge states: %v", err)
	}

	if total != 2 || active != 1 || consumed != 1 {
		t.Fatalf(
			"expected total=2, active=1, consumed=1; got total=%d active=%d consumed=%d",
			total,
			active,
			consumed,
		)
	}
}

func TestVerifyChallenge_Success(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	err := verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "123456"),
	)
	if err != nil {
		t.Fatalf("verify challenge: %v", err)
	}

	var verified bool

	err = pool.QueryRow(
		context.Background(),
		`SELECT email_verified_at IS NOT NULL
		 FROM users
		 WHERE id = $1`,
		user.ID,
	).Scan(&verified)

	if err != nil {
		t.Fatalf("read email verification status: %v", err)
	}

	if !verified {
		t.Fatal("expected email to be verified")
	}

	err = verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "123456"),
	)

	if !errors.Is(err, ErrChallengeConsumed) {
		t.Fatalf("expected ErrChallengeConsumed, got %v", err)
	}
}

func TestVerifyChallenge_IncorrectCode(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	err := verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "999999"),
	)

	if !errors.Is(err, ErrInvalidChallengeCode) {
		t.Fatalf("expected ErrInvalidChallengeCode, got %v", err)
	}

	// A failed attempt must not prevent a subsequent correct attempt.
	err = verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "123456"),
	)

	if err != nil {
		t.Fatalf("expected correct code to succeed, got %v", err)
	}
}

func TestVerifyChallenge_FiveFailedAttempts(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	for attempt := 1; attempt <= maxChallengeAttempts; attempt++ {
		err := verifyTestChallenge(
			repo,
			user,
			candidateChallengeHash(t, "999999"),
		)

		if attempt < maxChallengeAttempts {
			if !errors.Is(err, ErrInvalidChallengeCode) {
				t.Fatalf(
					"attempt %d: expected ErrInvalidChallengeCode, got %v",
					attempt,
					err,
				)
			}
		} else {
			if !errors.Is(err, ErrChallengeAttemptsExceeded) {
				t.Fatalf(
					"attempt %d: expected ErrChallengeAttemptsExceeded, got %v",
					attempt,
					err,
				)
			}
		}
	}

	err := verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "123456"),
	)

	if !errors.Is(err, ErrChallengeConsumed) {
		t.Fatalf("expected consumed challenge, got %v", err)
	}
}

func TestVerifyChallenge_Expired(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	_, err := pool.Exec(
		context.Background(),
		`UPDATE auth_verification_challenges
		 SET expires_at = NOW() - INTERVAL '1 minute'
		 WHERE user_id = $1
		   AND purpose = 'verify_email'`,
		user.ID,
	)

	if err != nil {
		t.Fatalf("expire challenge: %v", err)
	}

	err = verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "123456"),
	)

	if !errors.Is(err, ErrChallengeExpired) {
		t.Fatalf("expected ErrChallengeExpired, got %v", err)
	}
}

func TestVerifyChallenge_Consumed(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	err := verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "123456"),
	)
	if err != nil {
		t.Fatalf("first verification: %v", err)
	}

	err = verifyTestChallenge(
		repo,
		user,
		candidateChallengeHash(t, "123456"),
	)

	if !errors.Is(err, ErrChallengeConsumed) {
		t.Fatalf("expected ErrChallengeConsumed, got %v", err)
	}
}

func TestVerifyChallenge_ConcurrentVerification(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)

	createTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	hash := candidateChallengeHash(t, "123456")

	const workers = 2

	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		success int
	)

	errorsFound := make(chan error, workers)

	for i := 0; i < workers; i++ {
		wg.Add(1)

		go func() {
			defer wg.Done()

			err := verifyTestChallenge(repo, user, hash)

			if err == nil {
				mu.Lock()
				success++
				mu.Unlock()
				return
			}

			errorsFound <- err
		}()
	}

	wg.Wait()
	close(errorsFound)

	if success != 1 {
		t.Fatalf("expected exactly one successful verification, got %d", success)
	}

	for err := range errorsFound {
		if !errors.Is(err, ErrChallengeConsumed) {
			t.Fatalf(
				"expected second verification to see consumed challenge, got %v",
				err,
			)
		}
	}
}

func TestResetPasswordWithChallenge_Success(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)
	ctx := context.Background()

	newPassword := "NewIntegrationPassword456!"
	newPasswordHash, err := HashPassword(newPassword)
	if err != nil {
		t.Fatalf("hash new password: %v", err)
	}

	candidateHash := createPasswordResetTestChallenge(
		t, repo, user, "123456", time.Now().Add(10*time.Minute),
	)

	err = repo.ResetPasswordWithChallenge(
		ctx, user.ID, "password_reset", "email", user.Email,
		candidateHash, newPasswordHash,
	)
	if err != nil {
		t.Fatalf("reset password: %v", err)
	}

	var storedHash string
	err = pool.QueryRow(
		ctx,
		`SELECT password_hash FROM users WHERE id = $1`,
		user.ID,
	).Scan(&storedHash)
	if err != nil {
		t.Fatalf("read updated password hash: %v", err)
	}

	valid, err := VerifyPassword(newPassword, storedHash)
	if err != nil {
		t.Fatalf("verify new password: %v", err)
	}
	if !valid {
		t.Fatal("expected new password to be stored")
	}

	var consumed bool
	err = pool.QueryRow(
		ctx,
		`
		SELECT consumed_at IS NOT NULL
		FROM auth_verification_challenges
		WHERE user_id = $1 AND purpose = 'password_reset'
		`,
		user.ID,
	).Scan(&consumed)
	if err != nil {
		t.Fatalf("read challenge state: %v", err)
	}
	if !consumed {
		t.Fatal("expected reset challenge to be consumed")
	}
}

func TestResetPasswordWithChallenge_FiveFailedAttempts(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)
	ctx := context.Background()

	createPasswordResetTestChallenge(
		t, repo, user, "123456", time.Now().Add(10*time.Minute),
	)
	wrongHash := candidateChallengeHash(t, "999999")

	for attempt := 1; attempt <= maxChallengeAttempts; attempt++ {
		err := repo.ResetPasswordWithChallenge(
			ctx,
			user.ID,
			"password_reset",
			"email",
			user.Email,
			wrongHash,
			"unused-password-hash",
		)

		if attempt < maxChallengeAttempts {
			if !errors.Is(err, ErrInvalidChallengeCode) {
				t.Fatalf(
					"attempt %d: expected ErrInvalidChallengeCode, got %v",
					attempt, err,
				)
			}
		} else if !errors.Is(err, ErrChallengeAttemptsExceeded) {
			t.Fatalf(
				"attempt %d: expected ErrChallengeAttemptsExceeded, got %v",
				attempt, err,
			)
		}
	}

	var attempts int
	var consumed bool
	err := pool.QueryRow(
		ctx,
		`
		SELECT attempts, consumed_at IS NOT NULL
		FROM auth_verification_challenges
		WHERE user_id = $1 AND purpose = 'password_reset'
		`,
		user.ID,
	).Scan(&attempts, &consumed)
	if err != nil {
		t.Fatalf("read challenge state: %v", err)
	}

	if attempts != maxChallengeAttempts {
		t.Fatalf("expected %d attempts, got %d", maxChallengeAttempts, attempts)
	}
	if !consumed {
		t.Fatal("expected challenge to be consumed after maximum attempts")
	}
}

func TestResetPasswordWithChallenge_Expired(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)
	ctx := context.Background()

	// Create a valid challenge first.
	candidateHash := createPasswordResetTestChallenge(
		t, repo, user, "123456", time.Now().Add(time.Hour),
	)

	// Expire the persisted challenge using the database clock.
	tag, err := pool.Exec(
		ctx,
		`
		UPDATE auth_verification_challenges
		SET expires_at = NOW() - INTERVAL '1 minute'
		WHERE user_id = $1
		  AND purpose = 'password_reset'
		`,
		user.ID,
	)
	if err != nil {
		t.Fatalf("expire password reset challenge: %v", err)
	}

	if tag.RowsAffected() != 1 {
		t.Fatalf(
			"expected to expire one challenge, updated %d",
			tag.RowsAffected(),
		)
	}

	newPasswordHash, err := HashPassword("NewIntegrationPassword456!")
	if err != nil {
		t.Fatalf("hash new password: %v", err)
	}

	err = repo.ResetPasswordWithChallenge(
		ctx, user.ID, "password_reset", "email", user.Email,
		candidateHash, newPasswordHash,
	)
	if !errors.Is(err, ErrChallengeExpired) {
		t.Fatalf("expected ErrChallengeExpired, got %v", err)
	}

	var consumed bool
	err = pool.QueryRow(
		ctx,
		`
		SELECT consumed_at IS NOT NULL
		FROM auth_verification_challenges
		WHERE user_id = $1
		  AND purpose = 'password_reset'
		`,
		user.ID,
	).Scan(&consumed)
	if err != nil {
		t.Fatalf("read challenge state: %v", err)
	}

	if !consumed {
		t.Fatal("expected expired challenge to be consumed")
	}
}

func TestResetPasswordWithChallenge_CannotReuseChallenge(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	user := newChallengeTestUser(t, repo)
	ctx := context.Background()

	candidateHash := createPasswordResetTestChallenge(
		t, repo, user, "123456", time.Now().Add(10*time.Minute),
	)

	newPasswordHash, err := HashPassword("NewIntegrationPassword456!")
	if err != nil {
		t.Fatalf("hash new password: %v", err)
	}

	err = repo.ResetPasswordWithChallenge(
		ctx, user.ID, "password_reset", "email", user.Email,
		candidateHash, newPasswordHash,
	)
	if err != nil {
		t.Fatalf("first password reset: %v", err)
	}

	err = repo.ResetPasswordWithChallenge(
		ctx, user.ID, "password_reset", "email", user.Email,
		candidateHash, newPasswordHash,
	)
	if !errors.Is(err, ErrChallengeConsumed) {
		t.Fatalf("expected ErrChallengeConsumed on reuse, got %v", err)
	}
}

func TestResetPasswordWithChallenge_RevokesAllActiveSessions(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	user := newChallengeTestUser(t, repo)

	// Create two active sessions in separate families.
	firstInput := newTestSessionInput(t, ctx, repo, user.ID)
	_, err := repo.CreateSession(ctx, firstInput)
	if err != nil {
		t.Fatalf("create first session: %v", err)
	}

	secondInput := newTestSessionInput(t, ctx, repo, user.ID)
	_, err = repo.CreateSession(ctx, secondInput)
	if err != nil {
		t.Fatalf("create second session: %v", err)
	}

	var activeBefore int
	err = pool.QueryRow(
		ctx,
		`
		SELECT COUNT(*)
		FROM user_sessions
		WHERE user_id = $1
		  AND revoked_at IS NULL
		`,
		user.ID,
	).Scan(&activeBefore)
	if err != nil {
		t.Fatalf("count active sessions before reset: %v", err)
	}

	if activeBefore != 2 {
		t.Fatalf("expected 2 active sessions before reset, got %d", activeBefore)
	}

	// Create a valid password-reset challenge.
	candidateHash := createPasswordResetTestChallenge(
		t,
		repo,
		user,
		"123456",
		time.Now().Add(10*time.Minute),
	)

	newPasswordHash, err := HashPassword("NewIntegrationPassword456!")
	if err != nil {
		t.Fatalf("hash new password: %v", err)
	}

	// Reset the password.
	err = repo.ResetPasswordWithChallenge(
		ctx,
		user.ID,
		"password_reset",
		"email",
		user.Email,
		candidateHash,
		newPasswordHash,
	)
	if err != nil {
		t.Fatalf("reset password: %v", err)
	}

	// Confirm no active sessions remain.
	var activeAfter int
	err = pool.QueryRow(
		ctx,
		`
		SELECT COUNT(*)
		FROM user_sessions
		WHERE user_id = $1
		  AND revoked_at IS NULL
		`,
		user.ID,
	).Scan(&activeAfter)
	if err != nil {
		t.Fatalf("count active sessions after reset: %v", err)
	}

	if activeAfter != 0 {
		t.Fatalf("expected 0 active sessions after reset, got %d", activeAfter)
	}

	// Confirm both sessions have the expected revocation reason.
	var revokedCount int
	err = pool.QueryRow(
		ctx,
		`
		SELECT COUNT(*)
		FROM user_sessions
		WHERE user_id = $1
		  AND revoked_at IS NOT NULL
		  AND revoked_reason = 'password_reset'
		`,
		user.ID,
	).Scan(&revokedCount)
	if err != nil {
		t.Fatalf("count password-reset-revoked sessions: %v", err)
	}

	if revokedCount != 2 {
		t.Fatalf("expected 2 sessions revoked for password_reset, got %d", revokedCount)
	}
}
