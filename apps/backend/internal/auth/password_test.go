package auth

import (
	"errors"
	"strings"
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "StrongPassword123!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}

	if hash == "" {
		t.Fatal("expected a non-empty password hash")
	}

	if !strings.HasPrefix(hash, "$argon2id$v=19$") {
		t.Errorf("unexpected hash format: %q", hash)
	}
}

func TestHashPasswordUsesUniqueSalts(t *testing.T) {
	password := "StrongPassword123!"

	first, err := HashPassword(password)
	if err != nil {
		t.Fatalf("first HashPassword returned error: %v", err)
	}

	second, err := HashPassword(password)
	if err != nil {
		t.Fatalf("second HashPassword returned error: %v", err)
	}

	if first == second {
		t.Error("expected different hashes because each password uses a new salt")
	}
}

func TestHashPasswordRejectsEmptyPassword(t *testing.T) {
	_, err := HashPassword("")

	if !errors.Is(err, ErrEmptyPassword) {
		t.Errorf("expected ErrEmptyPassword, got %v", err)
	}
}

func TestHashPasswordRejectsLongPassword(t *testing.T) {
	password := strings.Repeat("a", maxPasswordLength+1)

	_, err := HashPassword(password)

	if !errors.Is(err, ErrPasswordTooLong) {
		t.Errorf("expected ErrPasswordTooLong, got %v", err)
	}
}

func TestVerifyPassword(t *testing.T) {
	password := "StrongPassword123!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}

	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{
			name:     "correct password",
			password: password,
			want:     true,
		},
		{
			name:     "incorrect password",
			password: "WrongPassword123!",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := VerifyPassword(tt.password, hash)
			if err != nil {
				t.Fatalf("VerifyPassword returned error: %v", err)
			}

			if got != tt.want {
				t.Errorf("VerifyPassword = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVerifyPasswordRejectsEmptyPassword(t *testing.T) {
	_, err := VerifyPassword("", "some-hash")

	if !errors.Is(err, ErrEmptyPassword) {
		t.Errorf("expected ErrEmptyPassword, got %v", err)
	}
}

func TestVerifyPasswordRejectsMalformedHash(t *testing.T) {
	tests := []struct {
		name string
		hash string
	}{
		{name: "empty hash", hash: ""},
		{name: "invalid algorithm", hash: "$bcrypt$something"},
		{name: "missing components", hash: "$argon2id$v=19$"},
		{name: "invalid salt encoding", hash: "$argon2id$v=19$m=19456,t=2,p=1$%%%$abc"},
		{name: "wrong parameters", hash: "$argon2id$v=19$m=999999,t=2,p=1$YWJj$YWJj"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := VerifyPassword("password", tt.hash)

			if !errors.Is(err, ErrInvalidPasswordHash) {
				t.Errorf("expected ErrInvalidPasswordHash, got %v", err)
			}
		})
	}
}
