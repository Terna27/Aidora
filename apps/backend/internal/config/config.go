package config

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

var ErrInvalidConfig = errors.New("invalid application configuration")

type JWTConfig struct {
	Issuer               string
	Audience             string
	PrivateKey           ed25519.PrivateKey
	PublicKey            ed25519.PublicKey
	RefreshTokenLifetime time.Duration
}

func LoadJWTConfig() (JWTConfig, error) {
	issuer := strings.TrimSpace(os.Getenv("JWT_ISSUER"))
	audience := strings.TrimSpace(os.Getenv("JWT_AUDIENCE"))

	privateKeyValue := strings.TrimSpace(os.Getenv("JWT_PRIVATE_KEY"))
	publicKeyValue := strings.TrimSpace(os.Getenv("JWT_PUBLIC_KEY"))
	refreshLifetimeValue := strings.TrimSpace(os.Getenv("AUTH_REFRESH_TOKEN_LIFETIME"))

	if issuer == "" || audience == "" {
		return JWTConfig{}, fmt.Errorf(
			"%w: JWT issuer and audience are required",
			ErrInvalidConfig,
		)
	}

	if privateKeyValue == "" || publicKeyValue == "" {
		return JWTConfig{}, fmt.Errorf(
			"%w: JWT signing and verification keys are required",
			ErrInvalidConfig,
		)
	}

	if refreshLifetimeValue == "" {
		return JWTConfig{}, fmt.Errorf(
			"%w: refresh-token lifetime is required",
			ErrInvalidConfig,
		)
	}

	refreshLifetime, err := time.ParseDuration(refreshLifetimeValue)
	if err != nil || refreshLifetime <= 0 {
		return JWTConfig{}, fmt.Errorf(
			"%w: invalid refresh-token lifetime",
			ErrInvalidConfig,
		)
	}

	privateKeyBytes, err := base64.StdEncoding.DecodeString(privateKeyValue)
	if err != nil || len(privateKeyBytes) != ed25519.PrivateKeySize {
		return JWTConfig{}, fmt.Errorf(
			"%w: invalid JWT private key",
			ErrInvalidConfig,
		)
	}

	publicKeyBytes, err := base64.StdEncoding.DecodeString(publicKeyValue)
	if err != nil || len(publicKeyBytes) != ed25519.PublicKeySize {
		return JWTConfig{}, fmt.Errorf(
			"%w: invalid JWT public key",
			ErrInvalidConfig,
		)
	}

	privateKey := ed25519.PrivateKey(privateKeyBytes)
	publicKey := ed25519.PublicKey(publicKeyBytes)

	derivedPublicKey := privateKey.Public().(ed25519.PublicKey)
	if !derivedPublicKey.Equal(publicKey) {
		return JWTConfig{}, fmt.Errorf(
			"%w: JWT public and private keys do not match",
			ErrInvalidConfig,
		)
	}

	return JWTConfig{
		Issuer:               issuer,
		Audience:             audience,
		PrivateKey:           privateKey,
		PublicKey:            publicKey,
		RefreshTokenLifetime: refreshLifetime,
	}, nil
}
