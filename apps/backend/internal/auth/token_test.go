package auth

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	testIssuer   = "aidora-test"
	testAudience = "aidora-api-test"
)

func newTestTokenComponents(t *testing.T) (
	*TokenSigner,
	*TokenVerifier,
	ed25519.PrivateKey,
	ed25519.PublicKey,
) {
	t.Helper()

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate Ed25519 keys: %v", err)
	}

	signer, err := NewTokenSigner(
		privateKey,
		testIssuer,
		testAudience,
	)
	if err != nil {
		t.Fatalf("create token signer: %v", err)
	}

	verifier, err := NewTokenVerifier(
		publicKey,
		testIssuer,
		testAudience,
	)
	if err != nil {
		t.Fatalf("create token verifier: %v", err)
	}

	return signer, verifier, privateKey, publicKey
}

func signTestToken(
	t *testing.T,
	privateKey any,
	method jwt.SigningMethod,
	claims jwt.RegisteredClaims,
) string {
	t.Helper()

	token := jwt.NewWithClaims(
		method,
		accessTokenClaims{RegisteredClaims: claims},
	)

	signed, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign test token: %v", err)
	}

	return signed
}

func validTestClaims() jwt.RegisteredClaims {
	now := time.Now()

	return jwt.RegisteredClaims{
		Issuer:    testIssuer,
		Subject:   uuid.NewString(),
		Audience:  jwt.ClaimStrings{testAudience},
		ExpiresAt: jwt.NewNumericDate(now.Add(AccessTokenLifetime)),
		IssuedAt:  jwt.NewNumericDate(now),
		ID:        uuid.NewString(),
	}
}

func TestTokenSignerAndVerifierGenerateAndAuthenticate(t *testing.T) {
	signer, verifier, _, _ := newTestTokenComponents(t)

	userID := uuid.NewString()

	token, err := signer.GenerateAccessToken(userID)
	if err != nil {
		t.Fatalf("generate access token: %v", err)
	}

	principal, err := verifier.Authenticate(context.Background(), token)
	if err != nil {
		t.Fatalf("authenticate valid token: %v", err)
	}

	if principal.UserID != userID {
		t.Fatalf(
			"expected user ID %q, got %q",
			userID,
			principal.UserID,
		)
	}
}

func TestTokenVerifierRejectsInvalidTokens(t *testing.T) {
	_, verifier, privateKey, _ := newTestTokenComponents(t)

	_, wrongPrivateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate wrong key: %v", err)
	}

	expiredClaims := validTestClaims()
	expiredClaims.ExpiresAt = jwt.NewNumericDate(
		time.Now().Add(-time.Minute),
	)

	wrongIssuerClaims := validTestClaims()
	wrongIssuerClaims.Issuer = "wrong-issuer"

	wrongAudienceClaims := validTestClaims()
	wrongAudienceClaims.Audience = jwt.ClaimStrings{"wrong-audience"}

	missingExpiryClaims := validTestClaims()
	missingExpiryClaims.ExpiresAt = nil

	missingIssuedAtClaims := validTestClaims()
	missingIssuedAtClaims.IssuedAt = nil

	missingSubjectClaims := validTestClaims()
	missingSubjectClaims.Subject = ""

	missingIDClaims := validTestClaims()
	missingIDClaims.ID = ""

	futureIssuedAtClaims := validTestClaims()
	futureIssuedAtClaims.IssuedAt = jwt.NewNumericDate(
		time.Now().Add(time.Minute),
	)

	tests := []struct {
		name  string
		token string
	}{
		{
			name:  "malformed token",
			token: "not-a-jwt",
		},
		{
			name: "expired token",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, expiredClaims,
			),
		},
		{
			name: "wrong issuer",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, wrongIssuerClaims,
			),
		},
		{
			name: "wrong audience",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, wrongAudienceClaims,
			),
		},
		{
			name: "missing expiration",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, missingExpiryClaims,
			),
		},
		{
			name: "missing issued at",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, missingIssuedAtClaims,
			),
		},
		{
			name: "missing subject",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, missingSubjectClaims,
			),
		},
		{
			name: "missing token ID",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, missingIDClaims,
			),
		},
		{
			name: "future issued at",
			token: signTestToken(
				t, privateKey, jwt.SigningMethodEdDSA, futureIssuedAtClaims,
			),
		},
		{
			name: "wrong signing key",
			token: signTestToken(
				t, wrongPrivateKey, jwt.SigningMethodEdDSA, validTestClaims(),
			),
		},
		{
			name: "wrong signing algorithm",
			token: signTestToken(
				t, []byte("test-secret"),
				jwt.SigningMethodHS256, validTestClaims(),
			),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			principal, err := verifier.Authenticate(
				context.Background(),
				test.token,
			)

			if err == nil {
				t.Fatal("expected authentication to fail")
			}

			if !errors.Is(err, ErrInvalidAccessToken) {
				t.Fatalf(
					"expected ErrInvalidAccessToken, got %v",
					err,
				)
			}

			if principal.UserID != "" {
				t.Fatalf(
					"expected empty principal, got %q",
					principal.UserID,
				)
			}
		})
	}
}

func TestTokenSignerRejectsInvalidUserID(t *testing.T) {
	signer, _, _, _ := newTestTokenComponents(t)

	_, err := signer.GenerateAccessToken("not-a-uuid")

	if err == nil {
		t.Fatal("expected invalid user ID to be rejected")
	}
}

func TestTokenVerifierRejectsCancelledContext(t *testing.T) {
	signer, verifier, _, _ := newTestTokenComponents(t)

	token, err := signer.GenerateAccessToken(uuid.NewString())
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err = verifier.Authenticate(ctx, token)

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestTokenSignerTrimsUserID(t *testing.T) {
	signer, verifier, _, _ := newTestTokenComponents(t)

	userID := uuid.NewString()

	token, err := signer.GenerateAccessToken(" " + userID + " ")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	principal, err := verifier.Authenticate(context.Background(), token)
	if err != nil {
		t.Fatalf("authenticate token: %v", err)
	}

	if strings.TrimSpace(principal.UserID) != userID {
		t.Fatalf("unexpected user ID: %q", principal.UserID)
	}
}
