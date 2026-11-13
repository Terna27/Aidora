package auth

import (
	"context"
	"errors"
	"testing"
)

func TestRepositoryCreateUserValidation(t *testing.T) {
	repo := NewRepository(nil)

	validInput := CreateUserInput{
		FullName:     "Test User",
		Email:        "test@example.test",
		PhoneNumber:  "+2348012345678",
		PasswordHash: "valid-password-hash",
		Role:         "patient",
	}

	testCases := []struct {
		name  string
		input CreateUserInput
	}{
		{
			name: "empty full name",
			input: func() CreateUserInput {
				input := validInput
				input.FullName = ""
				return input
			}(),
		},
		{
			name: "whitespace full name",
			input: func() CreateUserInput {
				input := validInput
				input.FullName = "   "
				return input
			}(),
		},
		{
			name: "empty email",
			input: func() CreateUserInput {
				input := validInput
				input.Email = ""
				return input
			}(),
		},
		{
			name: "empty phone number",
			input: func() CreateUserInput {
				input := validInput
				input.PhoneNumber = ""
				return input
			}(),
		},
		{
			name: "empty password hash",
			input: func() CreateUserInput {
				input := validInput
				input.PasswordHash = ""
				return input
			}(),
		},
		{
			name: "invalid role",
			input: func() CreateUserInput {
				input := validInput
				input.Role = "superuser"
				return input
			}(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := repo.CreateUser(
				context.Background(),
				tc.input,
			)

			if err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestRepositoryAddRoleRejectsInvalidInput(t *testing.T) {
	repo := NewRepository(nil)

	testCases := []struct {
		name    string
		userID  string
		role    string
		wantErr error
	}{
		{
			name:    "empty user ID",
			userID:  "",
			role:    "patient",
			wantErr: ErrInvalidUserID,
		},
		{
			name:    "malformed user ID",
			userID:  "not-a-uuid",
			role:    "patient",
			wantErr: ErrInvalidUserID,
		},
		{
			name:    "invalid role",
			userID:  "00000000-0000-0000-0000-000000000001",
			role:    "superuser",
			wantErr: ErrInvalidRole,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := repo.AddRole(
				context.Background(),
				tc.userID,
				tc.role,
			)

			if !errors.Is(err, tc.wantErr) {
				t.Fatalf(
					"expected %v, got %v",
					tc.wantErr,
					err,
				)
			}
		})
	}
}
