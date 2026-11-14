package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrInvalidCredentials = errors.New("invalid email/phone or password")
	ErrUnverifiedIdentity = errors.New("identity must be verified before login")
)

// PublicUser contains user information safe to return through the API.
type PublicUser struct {
	ID          string   `json:"id"`
	FullName    string   `json:"fullName"`
	Email       string   `json:"email,omitempty"`
	PhoneNumber string   `json:"phoneNumber,omitempty"`
	Roles       []string `json:"roles"`
}

// RegisterInput is the public registration request.
type RegisterInput struct {
	FullName    string
	Email       string
	PhoneNumber string
	Password    string
}

// LoginInput accepts either an email address or phone number.
type LoginInput struct {
	Identifier string
	Password   string
}

// TokenPair contains credentials returned after successful authentication.
type TokenPair struct {
	AccessToken      string     `json:"accessToken"`
	RefreshToken     string     `json:"refreshToken"`
	TokenType        string     `json:"tokenType"`
	AccessExpiresAt  time.Time  `json:"accessExpiresAt"`
	RefreshExpiresAt time.Time  `json:"refreshExpiresAt"`
	User             PublicUser `json:"user"`
}

// Service coordinates authentication operations.
type Service struct {
	repository           *Repository
	signer               *TokenSigner
	refreshTokenLifetime time.Duration
	verificationPepper   []byte
	verificationSender   VerificationCodeSender
}

// NewService creates an authentication service.
// The refresh-token lifetime must come from the approved API contract/configuration.
func NewService(
	repository *Repository,
	signer *TokenSigner,
	refreshTokenLifetime time.Duration,
) (*Service, error) {
	if repository == nil || repository.pool == nil {
		return nil, errors.New("authentication repository is required")
	}
	if signer == nil {
		return nil, errors.New("token signer is required")
	}
	if refreshTokenLifetime <= 0 {
		return nil, errors.New("positive refresh-token lifetime is required")
	}

	return &Service{
		repository:           repository,
		signer:               signer,
		refreshTokenLifetime: refreshTokenLifetime,
	}, nil
}

// Register creates a patient account.
// Email and phone verification are handled by the verification workflow.
func (s *Service) Register(
	ctx context.Context,
	input RegisterInput,
) (PublicUser, error) {
	fullName := strings.TrimSpace(input.FullName)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	phone := strings.TrimSpace(input.PhoneNumber)

	if fullName == "" {
		return PublicUser{}, errors.New("full name is required")
	}
	if email == "" && phone == "" {
		return PublicUser{}, errors.New("email or phone number is required")
	}

	passwordHash, err := HashPassword(input.Password)
	if err != nil {
		return PublicUser{}, fmt.Errorf("hash registration password: %w", err)
	}

	user, err := s.repository.CreateUser(ctx, CreateUserInput{
		FullName:     fullName,
		Email:        email,
		PhoneNumber:  phone,
		PasswordHash: passwordHash,
		Role:         "patient",
	})
	if err != nil {
		return PublicUser{}, err
	}

	return toPublicUser(user), nil
}

// Login authenticates a verified email address or phone number.
func (s *Service) Login(
	ctx context.Context,
	input LoginInput,
) (TokenPair, error) {
	identifier := strings.TrimSpace(input.Identifier)
	if identifier == "" || input.Password == "" {
		return TokenPair{}, ErrInvalidCredentials
	}

	user, verified, err := s.getVerifiedLoginUser(ctx, identifier)
	if err != nil {
		// Keep account existence and verification status private.
		if errors.Is(err, ErrUserNotFound) {
			return TokenPair{}, ErrInvalidCredentials
		}
		return TokenPair{}, fmt.Errorf("find login user: %w", err)
	}

	if !verified {
		return TokenPair{}, ErrInvalidCredentials
	}

	valid, err := VerifyPassword(input.Password, user.PasswordHash)
	if err != nil || !valid {
		return TokenPair{}, ErrInvalidCredentials
	}

	return s.issueTokenPair(ctx, user, "")
}

// Refresh rotates a refresh token and issues a new access token.
func (s *Service) Refresh(
	ctx context.Context,
	refreshToken string,
) (TokenPair, error) {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return TokenPair{}, ErrInvalidCredentials
	}

	oldHash := hashRefreshToken(refreshToken)

	newToken, err := generateRefreshToken()
	if err != nil {
		return TokenPair{}, fmt.Errorf("generate replacement refresh token: %w", err)
	}

	newHash := hashRefreshToken(newToken)
	newExpiry := time.Now().Add(s.refreshTokenLifetime)

	session, err := s.repository.RotateSession(
		ctx,
		oldHash,
		newHash,
		newExpiry,
	)
	if err != nil {
		return TokenPair{}, err
	}

	user, err := s.repository.GetUserByID(ctx, session.UserID)
	if err != nil {
		_ = s.repository.RevokeSession(ctx, newHash)
		return TokenPair{}, fmt.Errorf("retrieve session user: %w", err)
	}

	accessToken, err := s.signer.GenerateAccessToken(user.ID)
	if err != nil {
		_ = s.repository.RevokeSession(ctx, newHash)
		return TokenPair{}, fmt.Errorf("generate access token: %w", err)
	}

	return TokenPair{
		AccessToken:      accessToken,
		RefreshToken:     newToken,
		TokenType:        "Bearer",
		AccessExpiresAt:  time.Now().Add(AccessTokenLifetime),
		RefreshExpiresAt: session.ExpiresAt,
		User:             toPublicUser(user),
	}, nil
}

// Logout revokes the session associated with the supplied refresh token.
func (s *Service) Logout(
	ctx context.Context,
	refreshToken string,
) error {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return ErrInvalidCredentials
	}

	return s.repository.RevokeSession(
		ctx,
		hashRefreshToken(refreshToken),
	)
}

// CurrentUser returns the public profile for an authenticated user.
func (s *Service) CurrentUser(
	ctx context.Context,
	userID string,
) (PublicUser, error) {
	user, err := s.repository.GetUserByID(ctx, userID)
	if err != nil {
		return PublicUser{}, fmt.Errorf("retrieve current user: %w", err)
	}

	return toPublicUser(user), nil
}

func (s *Service) issueTokenPair(
	ctx context.Context,
	user User,
	familyID string,
) (TokenPair, error) {
	refreshToken, err := generateRefreshToken()
	if err != nil {
		return TokenPair{}, fmt.Errorf("generate refresh token: %w", err)
	}

	if familyID == "" {
		familyID, err = generateUUID()
		if err != nil {
			return TokenPair{}, fmt.Errorf("generate session family ID: %w", err)
		}
	}

	now := time.Now()
	refreshExpiry := now.Add(s.refreshTokenLifetime)

	accessToken, err := s.signer.GenerateAccessToken(user.ID)
	if err != nil {
		return TokenPair{}, fmt.Errorf("generate access token: %w", err)
	}

	_, err = s.repository.CreateSession(ctx, CreateSessionInput{
		UserID:           user.ID,
		FamilyID:         familyID,
		RefreshTokenHash: hashRefreshToken(refreshToken),
		ExpiresAt:        refreshExpiry,
	})
	if err != nil {
		return TokenPair{}, fmt.Errorf("create login session: %w", err)
	}

	return TokenPair{
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		TokenType:        "Bearer",
		AccessExpiresAt:  now.Add(AccessTokenLifetime),
		RefreshExpiresAt: refreshExpiry,
		User:             toPublicUser(user),
	}, nil
}

func (s *Service) getVerifiedLoginUser(
	ctx context.Context,
	identifier string,
) (User, bool, error) {
	var (
		user     User
		verified bool
		err      error
	)

	if strings.Contains(identifier, "@") {
		email := strings.ToLower(identifier)

		err = s.repository.pool.QueryRow(
			ctx,
			`
			SELECT email_verified_at IS NOT NULL
			FROM users
			WHERE LOWER(email) = LOWER($1)
			`,
			email,
		).Scan(&verified)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return User{}, false, ErrUserNotFound
			}
			return User{}, false, err
		}

		user, err = s.repository.GetUserByEmail(ctx, email)
	} else {
		err = s.repository.pool.QueryRow(
			ctx,
			`
			SELECT phone_verified_at IS NOT NULL
			FROM users
			WHERE phone_number = $1
			`,
			identifier,
		).Scan(&verified)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return User{}, false, ErrUserNotFound
			}
			return User{}, false, err
		}

		user, err = s.repository.GetUserByPhoneNumber(ctx, identifier)
	}

	return user, verified, err
}

func toPublicUser(user User) PublicUser {
	return PublicUser{
		ID:          user.ID,
		FullName:    user.FullName,
		Email:       user.Email,
		PhoneNumber: user.PhoneNumber,
		Roles:       append([]string(nil), user.Roles...),
	}
}

func generateRefreshToken() (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(token), nil
}

func hashRefreshToken(token string) []byte {
	hash := sha256.Sum256([]byte(token))
	return hash[:]
}

func generateUUID() (string, error) {
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return "", err
	}

	id[6] = (id[6] & 0x0f) | 0x40
	id[8] = (id[8] & 0x3f) | 0x80

	return fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		id[0:4],
		id[4:6],
		id[6:8],
		id[8:10],
		id[10:16],
	), nil
}
