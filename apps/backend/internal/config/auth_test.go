package config

import (
	"errors"
	"testing"
)

func TestLoadAuthChallengeConfig(t *testing.T) {
	t.Run("loads a valid pepper", func(t *testing.T) {
		t.Setenv(
			"AUTH_CHALLENGE_PEPPER",
			"0123456789abcdef0123456789abcdef",
		)

		config, err := LoadAuthChallengeConfig()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if len(config.Pepper) < 32 {
			t.Fatal("expected pepper to contain at least 32 bytes")
		}
	})

	t.Run("rejects missing pepper", func(t *testing.T) {
		t.Setenv("AUTH_CHALLENGE_PEPPER", "")

		_, err := LoadAuthChallengeConfig()
		if !errors.Is(err, ErrMissingAuthChallengePepper) {
			t.Fatalf("expected missing pepper error, got %v", err)
		}
	})

	t.Run("rejects weak pepper", func(t *testing.T) {
		t.Setenv("AUTH_CHALLENGE_PEPPER", "too-short")

		_, err := LoadAuthChallengeConfig()
		if !errors.Is(err, ErrWeakAuthChallengePepper) {
			t.Fatalf("expected weak pepper error, got %v", err)
		}
	})
}
