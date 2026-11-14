package auth

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

func newTestSessionInput(
	t *testing.T,
	poolContext context.Context,
	pool *Repository,
	userID string,
) CreateSessionInput {
	t.Helper()

	var familyID string
	err := pool.pool.QueryRow(
		poolContext,
		`SELECT gen_random_uuid()::text`,
	).Scan(&familyID)
	if err != nil {
		t.Fatalf("generate session family ID: %v", err)
	}

	return CreateSessionInput{
		UserID:           userID,
		FamilyID:         familyID,
		RefreshTokenHash: testRefreshHash(t, "initial"),
		ExpiresAt:        time.Now().Add(24 * time.Hour),
	}
}

func testRefreshHash(t *testing.T, value string) []byte {
	t.Helper()

	sum := sha256.Sum256([]byte(fmt.Sprintf(
		"%s-%d",
		value,
		time.Now().UnixNano(),
	)))

	return sum[:]
}

func countActiveFamilySessions(
	t *testing.T,
	ctx context.Context,
	repo *Repository,
	familyID string,
) int {
	t.Helper()

	var count int
	err := repo.pool.QueryRow(
		ctx,
		`
		SELECT COUNT(*)
		FROM user_sessions
		WHERE family_id = $1
		  AND revoked_at IS NULL
		`,
		familyID,
	).Scan(&count)
	if err != nil {
		t.Fatalf("count active family sessions: %v", err)
	}

	return count
}

func TestSessionRepositoryCreateAndRotate(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	input := newTestSessionInput(t, ctx, repo, user.ID)

	created, err := repo.CreateSession(ctx, input)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	if created.ID == "" {
		t.Fatal("expected generated session ID")
	}
	if created.UserID != user.ID {
		t.Errorf("expected user ID %q, got %q", user.ID, created.UserID)
	}
	if created.FamilyID != input.FamilyID {
		t.Errorf("expected family ID %q, got %q", input.FamilyID, created.FamilyID)
	}

	newHash := testRefreshHash(t, "replacement")

	rotated, err := repo.RotateSession(
		ctx,
		input.RefreshTokenHash,
		newHash,
		time.Now().Add(48*time.Hour),
	)
	if err != nil {
		t.Fatalf("rotate session: %v", err)
	}

	if rotated.ID == created.ID {
		t.Error("expected replacement to have a different session ID")
	}
	if rotated.UserID != user.ID {
		t.Errorf("expected replacement user ID %q, got %q", user.ID, rotated.UserID)
	}
	if rotated.FamilyID != created.FamilyID {
		t.Errorf("expected replacement to remain in family %q, got %q", created.FamilyID, rotated.FamilyID)
	}

	var (
		revokedReason string
		replacedByID  string
	)
	err = pool.QueryRow(
		ctx,
		`
		SELECT revoked_reason, replaced_by_session_id::text
		FROM user_sessions
		WHERE id = $1
		`,
		created.ID,
	).Scan(&revokedReason, &replacedByID)
	if err != nil {
		t.Fatalf("retrieve rotated session: %v", err)
	}

	if revokedReason != "rotated" {
		t.Errorf("expected revoked reason 'rotated', got %q", revokedReason)
	}
	if replacedByID != rotated.ID {
		t.Errorf("expected replacement link %q, got %q", rotated.ID, replacedByID)
	}

	if count := countActiveFamilySessions(t, ctx, repo, created.FamilyID); count != 1 {
		t.Errorf("expected one active session in family, got %d", count)
	}
}

func TestSessionRepositoryDetectsReuseAndRevokesFamily(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	input := newTestSessionInput(t, ctx, repo, user.ID)

	created, err := repo.CreateSession(ctx, input)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	replacementHash := testRefreshHash(t, "replacement")
	_, err = repo.RotateSession(
		ctx,
		input.RefreshTokenHash,
		replacementHash,
		time.Now().Add(48*time.Hour),
	)
	if err != nil {
		t.Fatalf("first rotation: %v", err)
	}

	// Present the old token again. This must revoke the active replacement.
	_, err = repo.RotateSession(
		ctx,
		input.RefreshTokenHash,
		testRefreshHash(t, "second-replacement"),
		time.Now().Add(48*time.Hour),
	)
	if !errors.Is(err, ErrRefreshTokenReuse) {
		t.Fatalf("expected ErrRefreshTokenReuse, got %v", err)
	}

	if count := countActiveFamilySessions(t, ctx, repo, created.FamilyID); count != 0 {
		t.Errorf("expected all family sessions to be revoked, got %d active", count)
	}

	var reason string
	err = pool.QueryRow(
		ctx,
		`
		SELECT revoked_reason
		FROM user_sessions
		WHERE refresh_token_hash = $1
		`,
		replacementHash,
	).Scan(&reason)
	if err != nil {
		t.Fatalf("retrieve replacement session: %v", err)
	}

	if reason != "reuse_detected" {
		t.Errorf("expected replacement revocation reason 'reuse_detected', got %q", reason)
	}
}

func TestSessionRepositoryRejectsExpiredSession(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	input := newTestSessionInput(t, ctx, repo, user.ID)

	// Insert an expired session directly because CreateSession correctly
	// rejects sessions whose expiry is already in the past.
	var sessionID string
	err := pool.QueryRow(
		ctx,
		`
		INSERT INTO user_sessions (
			user_id,
			family_id,
			refresh_token_hash,
			expires_at
		)
		VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute')
		RETURNING id::text
		`,
		input.UserID,
		input.FamilyID,
		input.RefreshTokenHash,
	).Scan(&sessionID)
	if err != nil {
		t.Fatalf("insert expired session: %v", err)
	}

	_, err = repo.RotateSession(
		ctx,
		input.RefreshTokenHash,
		testRefreshHash(t, "replacement"),
		time.Now().Add(24*time.Hour),
	)
	if !errors.Is(err, ErrSessionExpired) {
		t.Fatalf("expected ErrSessionExpired, got %v", err)
	}

	var reason string
	err = pool.QueryRow(
		ctx,
		`SELECT revoked_reason FROM user_sessions WHERE id = $1`,
		sessionID,
	).Scan(&reason)
	if err != nil {
		t.Fatalf("retrieve expired session: %v", err)
	}

	if reason != "expired" {
		t.Errorf("expected revoked reason 'expired', got %q", reason)
	}
}

func TestSessionRepositoryRevokeSession(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	input := newTestSessionInput(t, ctx, repo, user.ID)

	_, err := repo.CreateSession(ctx, input)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	if err := repo.RevokeSession(ctx, input.RefreshTokenHash); err != nil {
		t.Fatalf("revoke session: %v", err)
	}

	// Logout should be safe to repeat.
	if err := repo.RevokeSession(ctx, input.RefreshTokenHash); err != nil {
		t.Fatalf("repeat session revocation: %v", err)
	}

	_, err = repo.RotateSession(
		ctx,
		input.RefreshTokenHash,
		testRefreshHash(t, "replacement"),
		time.Now().Add(24*time.Hour),
	)
	if !errors.Is(err, ErrSessionRevoked) {
		t.Fatalf("expected ErrSessionRevoked after logout, got %v", err)
	}

	err = repo.RevokeSession(ctx, testRefreshHash(t, "unknown"))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("expected ErrSessionNotFound for unknown token, got %v", err)
	}
}

func TestSessionRepositoryConcurrentRotationDetectsReuse(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	input := newTestSessionInput(t, ctx, repo, user.ID)

	created, err := repo.CreateSession(ctx, input)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	const attempts = 2

	start := make(chan struct{})
	results := make(chan error, attempts)

	var wg sync.WaitGroup

	for i := 0; i < attempts; i++ {
		wg.Add(1)

		go func(index int) {
			defer wg.Done()
			<-start

			_, err := repo.RotateSession(
				ctx,
				input.RefreshTokenHash,
				testRefreshHash(t, fmt.Sprintf("concurrent-%d", index)),
				time.Now().Add(24*time.Hour),
			)
			results <- err
		}(i)
	}

	close(start)
	wg.Wait()
	close(results)

	var successful, reuseDetected int

	for err := range results {
		switch {
		case err == nil:
			successful++
		case errors.Is(err, ErrRefreshTokenReuse):
			reuseDetected++
		default:
			t.Fatalf("unexpected concurrent rotation error: %v", err)
		}
	}

	if successful != 1 {
		t.Errorf("expected one successful rotation, got %d", successful)
	}
	if reuseDetected != 1 {
		t.Errorf("expected one reuse detection, got %d", reuseDetected)
	}

	if count := countActiveFamilySessions(t, ctx, repo, created.FamilyID); count != 0 {
		t.Errorf("expected concurrent reuse to revoke the family, got %d active sessions", count)
	}
}
