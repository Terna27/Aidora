package config

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"testing"
	"time"
)

func setValidJWTEnvironment(t *testing.T) {
	t.Helper()

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate Ed25519 keys: %v", err)
	}

	t.Setenv("JWT_ISSUER", "aidora-test")
	t.Setenv("JWT_AUDIENCE", "aidora-api-test")
	t.Setenv(
		"JWT_PRIVATE_KEY",
		base64.StdEncoding.EncodeToString(privateKey),
	)
	t.Setenv(
		"JWT_PUBLIC_KEY",
		base64.StdEncoding.EncodeToString(publicKey),
	)
}

func TestLoadJWTConfig(t *testing.T) {
	setValidJWTEnvironment(t)
	t.Setenv("AUTH_REFRESH_TOKEN_LIFETIME", "720h")

	config, err := LoadJWTConfig()
	if err != nil {
		t.Fatalf("load JWT configuration: %v", err)
	}

	if config.Issuer != "aidora-test" {
		t.Fatalf("unexpected issuer: %q", config.Issuer)
	}

	if config.Audience != "aidora-api-test" {
		t.Fatalf("unexpected audience: %q", config.Audience)
	}

	if len(config.PrivateKey) != ed25519.PrivateKeySize {
		t.Fatal("unexpected private key size")
	}

	if config.RefreshTokenLifetime != 30*24*time.Hour {
		t.Errorf(
			"refresh-token lifetime = %v, want %v",
			config.RefreshTokenLifetime,
			30*24*time.Hour,
		)
	}

	if len(config.PublicKey) != ed25519.PublicKeySize {
		t.Fatal("unexpected public key size")
	}

	derivedPublicKey := config.PrivateKey.Public().(ed25519.PublicKey)

	if !derivedPublicKey.Equal(config.PublicKey) {
		t.Fatal("loaded public and private keys do not match")
	}
}

func TestLoadJWTConfigRejectsMissingConfiguration(t *testing.T) {
	tests := []struct {
		name     string
		variable string
	}{
		{name: "missing issuer", variable: "JWT_ISSUER"},
		{name: "missing audience", variable: "JWT_AUDIENCE"},
		{name: "missing private key", variable: "JWT_PRIVATE_KEY"},
		{name: "missing public key", variable: "JWT_PUBLIC_KEY"},
		{name: "missing refresh-token lifetime", variable: "AUTH_REFRESH_TOKEN_LIFETIME"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setValidJWTEnvironment(t)
			t.Setenv(test.variable, "")

			_, err := LoadJWTConfig()

			if !errors.Is(err, ErrInvalidConfig) {
				t.Fatalf("expected ErrInvalidConfig, got %v", err)
			}
		})
	}
}

func TestLoadJWTConfigRejectsInvalidKeys(t *testing.T) {
	tests := []struct {
		name       string
		privateKey string
		publicKey  string
	}{
		{
			name:       "invalid private key encoding",
			privateKey: "not-base64!",
		},
		{
			name:      "invalid public key encoding",
			publicKey: "not-base64!",
		},
		{
			name:       "wrong private key length",
			privateKey: base64.StdEncoding.EncodeToString([]byte("short")),
		},
		{
			name:      "wrong public key length",
			publicKey: base64.StdEncoding.EncodeToString([]byte("short")),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setValidJWTEnvironment(t)

			if test.privateKey != "" {
				t.Setenv("JWT_PRIVATE_KEY", test.privateKey)
			}

			if test.publicKey != "" {
				t.Setenv("JWT_PUBLIC_KEY", test.publicKey)
			}

			_, err := LoadJWTConfig()

			if !errors.Is(err, ErrInvalidConfig) {
				t.Fatalf("expected ErrInvalidConfig, got %v", err)
			}
		})
	}
}

func TestLoadJWTConfigRejectsMismatchedKeys(t *testing.T) {
	setValidJWTEnvironment(t)

	_, anotherPrivateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate another key pair: %v", err)
	}

	t.Setenv(
		"JWT_PRIVATE_KEY",
		base64.StdEncoding.EncodeToString(anotherPrivateKey),
	)

	_, err = LoadJWTConfig()

	if !errors.Is(err, ErrInvalidConfig) {
		t.Fatalf("expected ErrInvalidConfig, got %v", err)
	}
}

func TestLoadJWTConfigRejectsInvalidRefreshTokenLifetime(t *testing.T) {
	tests := []struct {
		name  string
		value string
	}{
		{name: "missing", value: ""},
		{name: "invalid duration", value: "thirty days"},
		{name: "zero duration", value: "0s"},
		{name: "negative duration", value: "-24h"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setValidJWTEnvironment(t)
			t.Setenv("AUTH_REFRESH_TOKEN_LIFETIME", test.value)

			_, err := LoadJWTConfig()

			if !errors.Is(err, ErrInvalidConfig) {
				t.Fatalf("expected ErrInvalidConfig, got %v", err)
			}
		})
	}
}
