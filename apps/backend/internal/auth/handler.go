package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
)

const maxAuthRequestBodySize = 1 << 20 // 1 MB

// AuthService defines the authentication operations required by the handler.
type AuthService interface {
	Register(ctx context.Context, input RegisterInput) (PublicUser, error)
	Login(ctx context.Context, input LoginInput) (TokenPair, error)
	Refresh(ctx context.Context, refreshToken string) (TokenPair, error)
	Logout(ctx context.Context, refreshToken string) error
	CurrentUser(ctx context.Context, userID string) (PublicUser, error)

	RequestEmailVerification(ctx context.Context, email string) error
	VerifyEmail(ctx context.Context, email string, code string) error
	RequestPhoneVerification(ctx context.Context, phone string) error
	VerifyPhone(ctx context.Context, phone string, code string) error
}

// Handler handles authentication HTTP requests.
type Handler struct {
	service AuthService
}

func NewHandler(service AuthService) *Handler {
	return &Handler{service: service}
}

type registerRequest struct {
	FullName    string `json:"fullName"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phoneNumber"`
	Password    string `json:"password"`
}

type loginRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type logoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type emailVerificationRequest struct {
	Email string `json:"email"`
}

type emailVerificationConfirmRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type phoneVerificationRequest struct {
	PhoneNumber string `json:"phoneNumber"`
}

type phoneVerificationConfirmRequest struct {
	PhoneNumber string `json:"phoneNumber"`
	Code        string `json:"code"`
}

// Register handles POST /api/v1/auth/register.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var request registerRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.FullName) == "" ||
		(strings.TrimSpace(request.Email) == "" &&
			strings.TrimSpace(request.PhoneNumber) == "") ||
		request.Password == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_REGISTRATION",
			"Full name, email or phone number, and password are required.",
		)
		return
	}

	user, err := h.service.Register(r.Context(), RegisterInput{
		FullName:    request.FullName,
		Email:       request.Email,
		PhoneNumber: request.PhoneNumber,
		Password:    request.Password,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrEmailAlreadyExists):
			writeAuthError(
				w,
				http.StatusConflict,
				"EMAIL_ALREADY_EXISTS",
				"An account with this email address already exists.",
			)

		case errors.Is(err, ErrPhoneAlreadyExists):
			writeAuthError(
				w,
				http.StatusConflict,
				"PHONE_ALREADY_EXISTS",
				"An account with this phone number already exists.",
			)

		default:
			log.Printf("authentication registration failed: %v", err)
			writeAuthError(
				w,
				http.StatusInternalServerError,
				"INTERNAL_ERROR",
				"An unexpected error occurred.",
			)
		}
		return
	}

	if err := api.WriteSuccess(w, http.StatusCreated, user); err != nil {
		log.Printf("failed to write registration response: %v", err)
	}
}

// Login handles POST /api/v1/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var request loginRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.Identifier) == "" || request.Password == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_LOGIN_REQUEST",
			"Identifier and password are required.",
		)
		return
	}

	result, err := h.service.Login(r.Context(), LoginInput{
		Identifier: request.Identifier,
		Password:   request.Password,
	})
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			writeAuthError(
				w,
				http.StatusUnauthorized,
				"INVALID_CREDENTIALS",
				"Invalid email/phone or password.",
			)
			return
		}

		log.Printf("authentication login failed: %v", err)
		writeAuthError(
			w,
			http.StatusInternalServerError,
			"INTERNAL_ERROR",
			"An unexpected error occurred.",
		)
		return
	}

	if err := api.WriteSuccess(w, http.StatusOK, result); err != nil {
		log.Printf("failed to write login response: %v", err)
	}
}

// Refresh handles POST /api/v1/auth/refresh.
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var request refreshRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.RefreshToken) == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_REFRESH_REQUEST",
			"Refresh token is required.",
		)
		return
	}

	result, err := h.service.Refresh(r.Context(), request.RefreshToken)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidCredentials),
			errors.Is(err, ErrSessionNotFound),
			errors.Is(err, ErrSessionExpired),
			errors.Is(err, ErrSessionRevoked),
			errors.Is(err, ErrRefreshTokenReuse):
			writeAuthError(
				w,
				http.StatusUnauthorized,
				"INVALID_REFRESH_TOKEN",
				"Refresh token is invalid or no longer usable.",
			)

		default:
			log.Printf("authentication refresh failed: %v", err)
			writeAuthError(
				w,
				http.StatusInternalServerError,
				"INTERNAL_ERROR",
				"An unexpected error occurred.",
			)
		}
		return
	}

	if err := api.WriteSuccess(w, http.StatusOK, result); err != nil {
		log.Printf("failed to write refresh response: %v", err)
	}
}

// Logout handles POST /api/v1/auth/logout.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var request logoutRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.RefreshToken) == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_LOGOUT_REQUEST",
			"Refresh token is required.",
		)
		return
	}

	err := h.service.Logout(r.Context(), request.RefreshToken)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) ||
			errors.Is(err, ErrInvalidCredentials) {
			writeAuthError(
				w,
				http.StatusUnauthorized,
				"INVALID_REFRESH_TOKEN",
				"Refresh token is invalid.",
			)
			return
		}

		log.Printf("authentication logout failed: %v", err)
		writeAuthError(
			w,
			http.StatusInternalServerError,
			"INTERNAL_ERROR",
			"An unexpected error occurred.",
		)
		return
	}

	if err := api.WriteSuccess(w, http.StatusOK, map[string]bool{
		"loggedOut": true,
	}); err != nil {
		log.Printf("failed to write logout response: %v", err)
	}
}

// Me handles GET /api/v1/auth/me.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeAuthError(
			w,
			http.StatusUnauthorized,
			"UNAUTHENTICATED",
			"Authentication is required.",
		)
		return
	}

	user, err := h.service.CurrentUser(r.Context(), principal.UserID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			writeAuthError(
				w,
				http.StatusUnauthorized,
				"UNAUTHENTICATED",
				"Authentication is invalid.",
			)
			return
		}

		log.Printf("authentication current-user lookup failed: %v", err)
		writeAuthError(
			w,
			http.StatusInternalServerError,
			"INTERNAL_ERROR",
			"An unexpected error occurred.",
		)
		return
	}

	if err := api.WriteSuccess(w, http.StatusOK, user); err != nil {
		log.Printf("failed to write current-user response: %v", err)
	}
}

// RequestEmailVerification handles POST /api/v1/auth/verify/email/request.
func (h *Handler) RequestEmailVerification(w http.ResponseWriter, r *http.Request) {
	var request emailVerificationRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.Email) == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_VERIFICATION_REQUEST",
			"Email is required.",
		)
		return
	}

	if err := h.service.RequestEmailVerification(r.Context(), request.Email); err != nil {
		log.Printf("email verification request failed: %v", err)
		writeAuthError(
			w,
			http.StatusInternalServerError,
			"INTERNAL_ERROR",
			"An unexpected error occurred.",
		)
		return
	}

	if err := api.WriteSuccess(w, http.StatusAccepted, map[string]string{
		"message": "If the account is eligible, a verification code will be sent.",
	}); err != nil {
		log.Printf("failed to write email verification response: %v", err)
	}
}

// VerifyEmail handles POST /api/v1/auth/verify/email/confirm.
func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var request emailVerificationConfirmRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.Email) == "" || strings.TrimSpace(request.Code) == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_VERIFICATION_REQUEST",
			"Email and verification code are required.",
		)
		return
	}

	if err := h.service.VerifyEmail(r.Context(), request.Email, request.Code); err != nil {
		writeChallengeError(w, err, "email")
		return
	}

	if err := api.WriteSuccess(w, http.StatusOK, map[string]bool{
		"verified": true,
	}); err != nil {
		log.Printf("failed to write email verification response: %v", err)
	}
}

// RequestPhoneVerification handles POST /api/v1/auth/verify/phone/request.
func (h *Handler) RequestPhoneVerification(w http.ResponseWriter, r *http.Request) {
	var request phoneVerificationRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.PhoneNumber) == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_VERIFICATION_REQUEST",
			"Phone number is required.",
		)
		return
	}

	if err := h.service.RequestPhoneVerification(r.Context(), request.PhoneNumber); err != nil {
		log.Printf("phone verification request failed: %v", err)
		writeAuthError(
			w,
			http.StatusInternalServerError,
			"INTERNAL_ERROR",
			"An unexpected error occurred.",
		)
		return
	}

	if err := api.WriteSuccess(w, http.StatusAccepted, map[string]string{
		"message": "If the account is eligible, a verification code will be sent.",
	}); err != nil {
		log.Printf("failed to write phone verification response: %v", err)
	}
}

// VerifyPhone handles POST /api/v1/auth/verify/phone/confirm.
func (h *Handler) VerifyPhone(w http.ResponseWriter, r *http.Request) {
	var request phoneVerificationConfirmRequest

	if !decodeAuthRequest(w, r, &request) {
		return
	}

	if strings.TrimSpace(request.PhoneNumber) == "" || strings.TrimSpace(request.Code) == "" {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_VERIFICATION_REQUEST",
			"Phone number and verification code are required.",
		)
		return
	}

	if err := h.service.VerifyPhone(r.Context(), request.PhoneNumber, request.Code); err != nil {
		writeChallengeError(w, err, "phone")
		return
	}

	if err := api.WriteSuccess(w, http.StatusOK, map[string]bool{
		"verified": true,
	}); err != nil {
		log.Printf("failed to write phone verification response: %v", err)
	}
}

// writeChallengeError converts challenge errors into safe HTTP responses.
func writeChallengeError(w http.ResponseWriter, err error, channel string) {
	switch {
	case errors.Is(err, ErrInvalidChallengeCode),
		errors.Is(err, ErrChallengeNotFound),
		errors.Is(err, ErrChallengeConsumed):
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_VERIFICATION_CODE",
			"Verification code is invalid or no longer usable.",
		)

	case errors.Is(err, ErrChallengeExpired):
		writeAuthError(
			w,
			http.StatusGone,
			"VERIFICATION_CODE_EXPIRED",
			"Verification code has expired. Request a new code.",
		)

	case errors.Is(err, ErrChallengeAttemptsExceeded):
		writeAuthError(
			w,
			http.StatusTooManyRequests,
			"VERIFICATION_ATTEMPTS_EXCEEDED",
			"Too many incorrect attempts. Request a new code.",
		)

	case errors.Is(err, ErrInvalidChallengeInput):
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_VERIFICATION_REQUEST",
			"Verification request is invalid.",
		)

	default:
		log.Printf("%s verification failed: %v", channel, err)
		writeAuthError(
			w,
			http.StatusInternalServerError,
			"INTERNAL_ERROR",
			"An unexpected error occurred.",
		)
	}
}

// decodeAuthRequest validates and decodes exactly one JSON object.
func decodeAuthRequest(
	w http.ResponseWriter,
	r *http.Request,
	destination any,
) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthRequestBodySize)
	defer r.Body.Close()

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(destination); err != nil {
		var maxBytesErr *http.MaxBytesError

		if errors.As(err, &maxBytesErr) {
			writeAuthError(
				w,
				http.StatusRequestEntityTooLarge,
				"REQUEST_BODY_TOO_LARGE",
				"Request body exceeds the maximum allowed size.",
			)
			return false
		}

		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_REQUEST_BODY",
			"Request body must contain a valid JSON object.",
		)
		return false
	}

	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		writeAuthError(
			w,
			http.StatusBadRequest,
			"INVALID_REQUEST_BODY",
			"Request body must contain exactly one JSON object.",
		)
		return false
	}

	return true
}

func writeAuthError(
	w http.ResponseWriter,
	status int,
	code string,
	message string,
) {
	_ = api.WriteError(w, status, code, message, nil)
}
