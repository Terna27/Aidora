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

	err = repo.CreateChallenge(
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
		total   int
		active  int
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
