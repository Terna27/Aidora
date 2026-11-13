package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonMemory       uint32 = 19 * 1024
	argonIterations   uint32 = 2
	argonParallelism  uint8  = 1
	argonSaltLength          = 16
	argonKeyLength           = 32
	maxPasswordLength        = 1024
)

var (
	ErrEmptyPassword       = errors.New("password cannot be empty")
	ErrPasswordTooLong     = errors.New("password exceeds maximum length")
	ErrInvalidPasswordHash = errors.New("invalid password hash")
)

// HashPassword hashes a password using Argon2id.
func HashPassword(password string) (string, error) {
	if password == "" {
		return "", ErrEmptyPassword
	}

	if len(password) > maxPasswordLength {
		return "", ErrPasswordTooLong
	}

	salt := make([]byte, argonSaltLength)

	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate password salt: %w", err)
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		argonIterations,
		argonMemory,
		argonParallelism,
		argonKeyLength,
	)

	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	encodedHash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf(
		"$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory,
		argonIterations,
		argonParallelism,
		encodedSalt,
		encodedHash,
	)

	return encoded, nil
}

// VerifyPassword compares a password against an encoded Argon2id hash.
func VerifyPassword(password, encodedHash string) (bool, error) {
	if password == "" {
		return false, ErrEmptyPassword
	}

	if len(password) > maxPasswordLength {
		return false, ErrPasswordTooLong
	}

	salt, expectedHash, err := decodePasswordHash(encodedHash)
	if err != nil {
		return false, err
	}

	actualHash := argon2.IDKey(
		[]byte(password),
		salt,
		argonIterations,
		argonMemory,
		argonParallelism,
		argonKeyLength,
	)

	return subtle.ConstantTimeCompare(actualHash, expectedHash) == 1, nil
}

func decodePasswordHash(encoded string) ([]byte, []byte, error) {
	parts := strings.Split(encoded, "$")

	if len(parts) != 6 ||
		parts[0] != "" ||
		parts[1] != "argon2id" ||
		parts[2] != "v=19" ||
		parts[3] != fmt.Sprintf(
			"m=%d,t=%d,p=%d",
			argonMemory,
			argonIterations,
			argonParallelism,
		) {
		return nil, nil, ErrInvalidPasswordHash
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) != argonSaltLength {
		return nil, nil, ErrInvalidPasswordHash
	}

	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(hash) != argonKeyLength {
		return nil, nil, ErrInvalidPasswordHash
	}

	return salt, hash, nil
}
