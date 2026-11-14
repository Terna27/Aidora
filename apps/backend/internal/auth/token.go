
package auth

import (
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const AccessTokenLifetime = 15 * time.Minute

var (
	ErrInvalidAccessToken = errors.New("invalid access token")
	ErrInvalidTokenConfig = errors.New("invalid token configuration")
)

type accessTokenClaims struct {
	jwt.RegisteredClaims
}

// TokenSigner is responsible only for issuing access tokens.
type TokenSigner struct {
	privateKey ed25519.PrivateKey
	issuer     string
	audience   string
}

// TokenVerifier is responsible only for authenticating access tokens.
type TokenVerifier struct {
	publicKey ed25519.PublicKey
	issuer    string
	audience  string
}

func NewTokenSigner(
	privateKey ed25519.PrivateKey,
	issuer string,
	audience string,
) (*TokenSigner, error) {
	issuer = strings.TrimSpace(issuer)
	audience = strings.TrimSpace(audience)

	if len(privateKey) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf(
			"%w: invalid Ed25519 private key",
			ErrInvalidTokenConfig,
		)
	}

	if issuer == "" || audience == "" {
		return nil, fmt.Errorf(
			"%w: issuer and audience are required",
			ErrInvalidTokenConfig,
		)
	}

	return &TokenSigner{
		privateKey: privateKey,
		issuer:     issuer,
		audience:   audience,
	}, nil
}

func NewTokenVerifier(
	publicKey ed25519.PublicKey,
	issuer string,
	audience string,
) (*TokenVerifier, error) {
	issuer = strings.TrimSpace(issuer)
	audience = strings.TrimSpace(audience)

	if len(publicKey) != ed25519.PublicKeySize {
		return nil, fmt.Errorf(
			"%w: invalid Ed25519 public key",
			ErrInvalidTokenConfig,
		)
	}

	if issuer == "" || audience == "" {
		return nil, fmt.Errorf(
			"%w: issuer and audience are required",
			ErrInvalidTokenConfig,
		)
	}

	return &TokenVerifier{
		publicKey: publicKey,
		issuer:    issuer,
		audience:  audience,
	}, nil
}

func (s *TokenSigner) GenerateAccessToken(userID string) (string, error) {
	if s == nil {
		return "", ErrInvalidTokenConfig
	}

	parsedUserID, err := uuid.Parse(strings.TrimSpace(userID))
	if err != nil {
		return "", fmt.Errorf("invalid user ID: %w", err)
	}

	now := time.Now()

	claims := accessTokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   parsedUserID.String(),
			Audience:  jwt.ClaimStrings{s.audience},
			ExpiresAt: jwt.NewNumericDate(now.Add(AccessTokenLifetime)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        uuid.NewString(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)

	signedToken, err := token.SignedString(s.privateKey)
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}

	return signedToken, nil
}

func (v *TokenVerifier) Authenticate(
	ctx context.Context,
	accessToken string,
) (Principal, error) {
	if v == nil {
		return Principal{}, ErrInvalidAccessToken
	}

	if err := ctx.Err(); err != nil {
		return Principal{}, err
	}

	accessToken = strings.TrimSpace(accessToken)
	if accessToken == "" {
		return Principal{}, ErrInvalidAccessToken
	}

	claims := &accessTokenClaims{}

	token, err := jwt.ParseWithClaims(
		accessToken,
		claims,
		func(token *jwt.Token) (any, error) {
			if token.Method != jwt.SigningMethodEdDSA {
				return nil, ErrInvalidAccessToken
			}

			return v.publicKey, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
	)

	if err != nil || token == nil || !token.Valid {
		return Principal{}, ErrInvalidAccessToken
	}

	if claims.Subject == "" || claims.ID == "" || claims.IssuedAt == nil {
		return Principal{}, ErrInvalidAccessToken
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return Principal{}, ErrInvalidAccessToken
	}

	return Principal{
		UserID: userID.String(),
	}, nil
}
