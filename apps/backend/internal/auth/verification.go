package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

const (
	verificationCodeLength = 6
	verificationCodeTTL    = 10 * time.Minute

	verificationPurposeEmail         = "verify_email"
	verificationPurposePhone         = "verify_phone"
	verificationPurposePasswordReset = "password_reset"
)

// VerificationCodeSender abstracts email and SMS delivery.
// Implement this interface with the selected delivery provider later.
type VerificationCodeSender interface {
	SendVerificationCode(
		ctx context.Context,
		channel string,
		destination string,
		purpose string,
		code string,
	) error
}

// ConfigureVerification supplies the secret pepper and delivery adapter
// required by the verification workflow.
func (s *Service) ConfigureVerification(
	pepper []byte,
	sender VerificationCodeSender,
) error {
	if len(pepper) < 32 {
		return errors.New("verification pepper must contain at least 32 bytes")
	}

	s.verificationPepper = append([]byte(nil), pepper...)
	s.verificationSender = sender

	return nil
}

// RequestEmailVerification requests a new email verification code.
// Unknown accounts are deliberately treated as successful requests.
func (s *Service) RequestEmailVerification(
	ctx context.Context,
	email string,
) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || !strings.Contains(email, "@") {
		return nil
	}

	return s.requestVerification(
		ctx,
		email,
		verificationPurposeEmail,
		"email",
	)
}

// RequestPhoneVerification requests a new phone verification code.
// Unknown accounts are deliberately treated as successful requests.
func (s *Service) RequestPhoneVerification(
	ctx context.Context,
	phone string,
) error {
	phone = strings.TrimSpace(phone)
	if phone == "" || strings.Contains(phone, "@") {
		return nil
	}

	return s.requestVerification(
		ctx,
		phone,
		verificationPurposePhone,
		"phone",
	)
}

// RequestPasswordReset requests a password-reset code through a
// previously verified email address or phone number.
func (s *Service) RequestPasswordReset(
	ctx context.Context,
	identifier string,
	channel string,
) error {
	channel = strings.ToLower(strings.TrimSpace(channel))

	if !validChallengeChannel(verificationPurposePasswordReset, channel) {
		return ErrInvalidChallengeInput
	}

	identifier = strings.TrimSpace(identifier)

	if channel == "email" {
		identifier = strings.ToLower(identifier)
		if identifier == "" || !strings.Contains(identifier, "@") {
			return nil
		}
	} else if identifier == "" || strings.Contains(identifier, "@") {
		return nil
	}

	if len(s.verificationPepper) < 32 || s.verificationSender == nil {
		return errors.New("verification workflow is not configured")
	}

	user, err := s.getUserByIdentifier(ctx, identifier, channel)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil
		}
		return fmt.Errorf("find password reset account: %w", err)
	}

	verified, err := s.identityIsVerified(ctx, user.ID, channel)
	if err != nil {
		return fmt.Errorf("check password reset identity: %w", err)
	}
	if !verified {
		return nil
	}

	code, err := generateVerificationCode()
	if err != nil {
		return fmt.Errorf("generate password reset code: %w", err)
	}

	codeHash, err := HashVerificationCode(code, s.verificationPepper)
	if err != nil {
		return fmt.Errorf("hash password reset code: %w", err)
	}

	err = s.repository.CreateChallenge(ctx, CreateChallengeInput{
		UserID:      user.ID,
		Purpose:     verificationPurposePasswordReset,
		Channel:     channel,
		Destination: identifier,
		CodeHash:    codeHash,
		ExpiresAt:   time.Now().Add(verificationCodeTTL),
	})
	if err != nil {
		return fmt.Errorf("create password reset challenge: %w", err)
	}

	if err := s.verificationSender.SendVerificationCode(
		ctx,
		channel,
		identifier,
		verificationPurposePasswordReset,
		code,
	); err != nil {
		_, invalidateErr := s.repository.pool.Exec(
			ctx,
			`
            UPDATE auth_verification_challenges
            SET consumed_at = NOW()
            WHERE user_id = $1
              AND purpose = $2
              AND consumed_at IS NULL
            `,
			user.ID,
			verificationPurposePasswordReset,
		)
		if invalidateErr != nil {
			return fmt.Errorf(
				"send password reset code: %w (also failed to invalidate challenge: %v)",
				err,
				invalidateErr,
			)
		}

		return fmt.Errorf("send password reset code: %w", err)
	}

	return nil
}

// ResetPassword verifies a password-reset code and changes the password.
// Challenge consumption, password update, and session revocation are
// performed atomically by the repository.
func (s *Service) ResetPassword(
	ctx context.Context,
	identifier string,
	channel string,
	code string,
	newPassword string,
) error {
	channel = strings.ToLower(strings.TrimSpace(channel))
	identifier = strings.TrimSpace(identifier)

	if !validChallengeChannel(verificationPurposePasswordReset, channel) {
		return ErrInvalidChallengeInput
	}

	if channel == "email" {
		identifier = strings.ToLower(identifier)
	}

	if identifier == "" || !isSixDigitCode(code) {
		return ErrInvalidChallengeInput
	}

	if len(s.verificationPepper) < 32 {
		return errors.New("verification workflow is not configured")
	}

	user, err := s.getUserByIdentifier(ctx, identifier, channel)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return ErrChallengeNotFound
		}
		return fmt.Errorf("find password reset account: %w", err)
	}

	verified, err := s.identityIsVerified(ctx, user.ID, channel)
	if err != nil {
		return fmt.Errorf("check password reset identity: %w", err)
	}
	if !verified {
		return ErrChallengeNotFound
	}

	passwordHash, err := HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("hash new password: %w", err)
	}

	candidateHash, err := HashVerificationCode(code, s.verificationPepper)
	if err != nil {
		return fmt.Errorf("hash password reset code: %w", err)
	}

	err = s.repository.ResetPasswordWithChallenge(
		ctx,
		user.ID,
		verificationPurposePasswordReset,
		channel,
		identifier,
		candidateHash,
		passwordHash,
	)
	if err != nil {
		return fmt.Errorf("reset password: %w", err)
	}

	return nil
}

func (s *Service) requestVerification(
	ctx context.Context,
	identifier string,
	purpose string,
	channel string,
) error {
	if len(s.verificationPepper) < 32 || s.verificationSender == nil {
		return errors.New("verification workflow is not configured")
	}

	user, err := s.getUserByIdentifier(ctx, identifier, channel)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil
		}
		return fmt.Errorf("find verification account: %w", err)
	}

	verified, err := s.identityIsVerified(ctx, user.ID, channel)
	if err != nil {
		return fmt.Errorf("check identity verification: %w", err)
	}
	if verified {
		return nil
	}

	code, err := generateVerificationCode()
	if err != nil {
		return fmt.Errorf("generate verification code: %w", err)
	}

	codeHash, err := HashVerificationCode(code, s.verificationPepper)
	if err != nil {
		return fmt.Errorf("hash verification code: %w", err)
	}

	destination := identifier

	err = s.repository.CreateChallenge(ctx, CreateChallengeInput{
		UserID:      user.ID,
		Purpose:     purpose,
		Channel:     channel,
		Destination: destination,
		CodeHash:    codeHash,
		ExpiresAt:   time.Now().Add(verificationCodeTTL),
	})
	if err != nil {
		return fmt.Errorf("create verification challenge: %w", err)
	}

	if err := s.verificationSender.SendVerificationCode(
		ctx,
		channel,
		destination,
		purpose,
		code,
	); err != nil {
		// Do not leave a usable code behind when delivery fails.
		_, invalidateErr := s.repository.pool.Exec(
			ctx,
			`
			UPDATE auth_verification_challenges
			SET consumed_at = NOW()
			WHERE user_id = $1
			  AND purpose = $2
			  AND consumed_at IS NULL
			`,
			user.ID,
			purpose,
		)
		if invalidateErr != nil {
			return fmt.Errorf(
				"send verification code: %w (also failed to invalidate challenge: %v)",
				err,
				invalidateErr,
			)
		}

		return fmt.Errorf("send verification code: %w", err)
	}

	return nil
}

// VerifyEmail verifies an email address using its six-digit code.
func (s *Service) VerifyEmail(
	ctx context.Context,
	email string,
	code string,
) error {
	return s.verifyIdentity(
		ctx,
		strings.ToLower(strings.TrimSpace(email)),
		code,
		verificationPurposeEmail,
		"email",
	)
}

// VerifyPhone verifies a phone number using its six-digit code.
func (s *Service) VerifyPhone(
	ctx context.Context,
	phone string,
	code string,
) error {
	return s.verifyIdentity(
		ctx,
		strings.TrimSpace(phone),
		code,
		verificationPurposePhone,
		"phone",
	)
}

func (s *Service) verifyIdentity(
	ctx context.Context,
	identifier string,
	code string,
	purpose string,
	channel string,
) error {
	if len(s.verificationPepper) < 32 {
		return errors.New("verification workflow is not configured")
	}

	if !isSixDigitCode(code) {
		return ErrInvalidChallengeCode
	}

	user, err := s.getUserByIdentifier(ctx, identifier, channel)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return ErrInvalidChallengeCode
		}
		return fmt.Errorf("find verification account: %w", err)
	}

	codeHash, err := HashVerificationCode(code, s.verificationPepper)
	if err != nil {
		return fmt.Errorf("hash submitted verification code: %w", err)
	}

	if err := s.repository.VerifyChallenge(
		ctx,
		user.ID,
		purpose,
		channel,
		identifier,
		codeHash,
	); err != nil {
		return err
	}

	return nil
}

func (s *Service) getUserByIdentifier(
	ctx context.Context,
	identifier string,
	channel string,
) (User, error) {
	switch channel {
	case "email":
		return s.repository.GetUserByEmail(ctx, identifier)
	case "phone":
		return s.repository.GetUserByPhoneNumber(ctx, identifier)
	default:
		return User{}, ErrInvalidChallengeInput
	}
}

func (s *Service) identityIsVerified(
	ctx context.Context,
	userID string,
	channel string,
) (bool, error) {
	var verified bool

	var query string
	switch channel {
	case "email":
		query = `
			SELECT email_verified_at IS NOT NULL
			FROM users
			WHERE id = $1
		`
	case "phone":
		query = `
			SELECT phone_verified_at IS NOT NULL
			FROM users
			WHERE id = $1
		`
	default:
		return false, ErrInvalidChallengeInput
	}

	err := s.repository.pool.QueryRow(ctx, query, userID).Scan(&verified)
	if err != nil {
		return false, err
	}

	return verified, nil
}

func generateVerificationCode() (string, error) {
	limit := big.NewInt(1_000_000)

	value, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%06d", value.Int64()), nil
}

func isSixDigitCode(code string) bool {
	if len(code) != verificationCodeLength {
		return false
	}

	for _, character := range code {
		if character < '0' || character > '9' {
			return false
		}
	}

	return true
}
