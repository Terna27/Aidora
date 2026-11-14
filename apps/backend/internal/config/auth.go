package config

import (
	"errors"
	"os"
	"strings"
)

var ErrMissingAuthChallengePepper = errors.New(
	"AUTH_CHALLENGE_PEPPER is required",
)

var ErrWeakAuthChallengePepper = errors.New(
	"AUTH_CHALLENGE_PEPPER must contain at least 32 bytes",
)

type AuthChallengeConfig struct {
	Pepper []byte
}

func LoadAuthChallengeConfig() (AuthChallengeConfig, error) {
	pepper := strings.TrimSpace(os.Getenv("AUTH_CHALLENGE_PEPPER"))

	if pepper == "" {
		return AuthChallengeConfig{}, ErrMissingAuthChallengePepper
	}

	if len([]byte(pepper)) < 32 {
		return AuthChallengeConfig{}, ErrWeakAuthChallengePepper
	}

	return AuthChallengeConfig{
		Pepper: []byte(pepper),
	}, nil
}
