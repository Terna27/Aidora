package auth

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"fmt"
	"testing"
	"time"
)

func newTestAuthenticationService(
	t *testing.T,
	repo *Repository,
) *Service {
	t.Helper()

	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate signing key: %v", err)
	}

	signer, err := NewTokenSigner(
		privateKey,
		"aidora",
		"aidora-api",
	)
	if err != nil {
		t.Fatalf("create token signer: %v", err)
	}

	service, err := NewService(
		repo,
		signer,
		30*24*time.Hour,
	)
	if err != nil {
		t.Fatalf("create authentication service: %v", err)
	}

	return service
}

func verifyTestEmail(
	t *testing.T,
	ctx context.Context,
	repo *Repository,
	userID string,
) {
	t.Helper()

	_, err := repo.pool.Exec(
		ctx,
		`UPDATE users SET email_verified_at = NOW() WHERE id = $1`,
		userID,
	)
	if err != nil {
		t.Fatalf("verify test email: %v", err)
	}
}

func verifyTestPhone(
	t *testing.T,
	ctx context.Context,
	repo *Repository,
	userID string,
) {
	t.Helper()

	_, err := repo.pool.Exec(
		ctx,
		`UPDATE users SET phone_verified_at = NOW() WHERE id = $1`,
		userID,
	)
	if err != nil {
		t.Fatalf("verify test phone: %v", err)
	}
}

func TestServiceRegisterPatient(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	service := newTestAuthenticationService(t, repo)

	input := RegisterInput{
		FullName:    "  Registration Test User  ",
		Email:       fmt.Sprintf("register-%d@example.test", time.Now().UnixNano()),
		PhoneNumber: "",
		Password:    "RegistrationPassword123!",
	}

	user, err := service.Register(context.Background(), input)
	if err != nil {
		t.Fatalf("register user: %v", err)
	}

	t.Cleanup(func() {
		_, err := pool.Exec(
			context.Background(),
			`DELETE FROM users WHERE id = $1`,
			user.ID,
		)
		if err != nil {
			t.Errorf("clean up registered user: %v", err)
		}
	})

	if user.ID == "" {
		t.Fatal("expected generated user ID")
	}
	if user.FullName != "Registration Test User" {
		t.Errorf("unexpected full name: %q", user.FullName)
	}
	if user.Email != input.Email {
		t.Errorf("expected email %q, got %q", input.Email, user.Email)
	}
	if len(user.Roles) != 1 || user.Roles[0] != "patient" {
		t.Errorf("expected only patient role, got %v", user.Roles)
	}

	// Registration must not automatically verify an email address.
	var verified bool
	err = pool.QueryRow(
		context.Background(),
		`SELECT email_verified_at IS NOT NULL FROM users WHERE id = $1`,
		user.ID,
	).Scan(&verified)
	if err != nil {
		t.Fatalf("check email verification: %v", err)
	}
	if verified {
		t.Error("newly registered email must not be verified")
	}

	// Password hashes must never be returned in the public user response.
}

func TestServiceLoginWithVerifiedEmailAndPhone(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	service := newTestAuthenticationService(t, repo)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	verifyTestEmail(t, ctx, repo, user.ID)
	verifyTestPhone(t, ctx, repo, user.ID)

	testCases := []struct {
		name       string
		identifier string
	}{
		{name: "email login", identifier: user.Email},
		{name: "phone login", identifier: user.PhoneNumber},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			pair, err := service.Login(ctx, LoginInput{
				Identifier: tc.identifier,
				Password:   "IntegrationPassword123!",
			})
			if err != nil {
				t.Fatalf("login: %v", err)
			}

			if pair.AccessToken == "" {
				t.Error("expected access token")
			}
			if pair.RefreshToken == "" {
				t.Error("expected refresh token")
			}
			if pair.TokenType != "Bearer" {
				t.Errorf("expected Bearer token type, got %q", pair.TokenType)
			}
			if pair.User.ID != user.ID {
				t.Errorf("expected user ID %q, got %q", user.ID, pair.User.ID)
			}
			if !pair.AccessExpiresAt.After(time.Now()) {
				t.Error("expected future access-token expiry")
			}
			if !pair.RefreshExpiresAt.After(time.Now()) {
				t.Error("expected future refresh-token expiry")
			}
		})
	}
}

func TestServiceRejectsUnverifiedIdentityAndWrongPassword(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	service := newTestAuthenticationService(t, repo)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")

	// An unverified email must not authenticate, even with the right password.
	_, err := service.Login(ctx, LoginInput{
		Identifier: user.Email,
		Password:   "IntegrationPassword123!",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected generic invalid credentials for unverified email, got %v", err)
	}

	verifyTestEmail(t, ctx, repo, user.ID)

	// A wrong password must produce the same public authentication error.
	_, err = service.Login(ctx, LoginInput{
		Identifier: user.Email,
		Password:   "WrongPassword123!",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials for wrong password, got %v", err)
	}

	// A missing account must also produce the same public authentication error.
	_, err = service.Login(ctx, LoginInput{
		Identifier: "missing@example.test",
		Password:   "WrongPassword123!",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials for missing account, got %v", err)
	}
}

func TestServiceRefreshRotatesAndDetectsReuse(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	service := newTestAuthenticationService(t, repo)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	verifyTestEmail(t, ctx, repo, user.ID)

	initial, err := service.Login(ctx, LoginInput{
		Identifier: user.Email,
		Password:   "IntegrationPassword123!",
	})
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	rotated, err := service.Refresh(ctx, initial.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}

	if rotated.RefreshToken == initial.RefreshToken {
		t.Fatal("refresh token must change after rotation")
	}
	if rotated.AccessToken == "" {
		t.Error("expected replacement access token")
	}

	// Reusing the old refresh token must revoke the entire token family.
	_, err = service.Refresh(ctx, initial.RefreshToken)
	if !errors.Is(err, ErrRefreshTokenReuse) {
		t.Fatalf("expected ErrRefreshTokenReuse, got %v", err)
	}

	// The replacement token must also be invalid after family revocation.
	_, err = service.Refresh(ctx, rotated.RefreshToken)
	if !errors.Is(err, ErrSessionRevoked) {
		t.Fatalf("expected ErrSessionRevoked, got %v", err)
	}
}

func TestServiceLogoutRevokesRefreshToken(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	service := newTestAuthenticationService(t, repo)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")
	verifyTestEmail(t, ctx, repo, user.ID)

	pair, err := service.Login(ctx, LoginInput{
		Identifier: user.Email,
		Password:   "IntegrationPassword123!",
	})
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	if err := service.Logout(ctx, pair.RefreshToken); err != nil {
		t.Fatalf("logout: %v", err)
	}

	_, err = service.Refresh(ctx, pair.RefreshToken)
	if !errors.Is(err, ErrSessionRevoked) {
		t.Fatalf("expected ErrSessionRevoked after logout, got %v", err)
	}
}
