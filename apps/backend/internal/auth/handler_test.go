package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type handlerTestService struct {
	emailRequestErr error
	emailVerifyErr  error
	phoneRequestErr error
	phoneVerifyErr  error
	resetRequestErr error
	resetErr        error

	emailRequestCalls int
	emailVerifyCalls  int
	phoneRequestCalls int
	phoneVerifyCalls  int
	resetRequestCalls int
	resetCalls        int

	gotEmail      string
	gotPhone      string
	gotCode       string
	gotIdentifier string
	gotChannel    string
	gotPassword   string
}

func (s *handlerTestService) Register(context.Context, RegisterInput) (PublicUser, error) {
	return PublicUser{}, nil
}

func (s *handlerTestService) Login(context.Context, LoginInput) (TokenPair, error) {
	return TokenPair{}, nil
}

func (s *handlerTestService) Refresh(context.Context, string) (TokenPair, error) {
	return TokenPair{}, nil
}

func (s *handlerTestService) Logout(context.Context, string) error {
	return nil
}

func (s *handlerTestService) CurrentUser(context.Context, string) (PublicUser, error) {
	return PublicUser{}, nil
}

func (s *handlerTestService) RequestEmailVerification(_ context.Context, email string) error {
	s.emailRequestCalls++
	s.gotEmail = email
	return s.emailRequestErr
}

func (s *handlerTestService) VerifyEmail(_ context.Context, email, code string) error {
	s.emailVerifyCalls++
	s.gotEmail = email
	s.gotCode = code
	return s.emailVerifyErr
}

func (s *handlerTestService) RequestPhoneVerification(_ context.Context, phone string) error {
	s.phoneRequestCalls++
	s.gotPhone = phone
	return s.phoneRequestErr
}

func (s *handlerTestService) VerifyPhone(_ context.Context, phone, code string) error {
	s.phoneVerifyCalls++
	s.gotPhone = phone
	s.gotCode = code
	return s.phoneVerifyErr
}

func (s *handlerTestService) RequestPasswordReset(
	_ context.Context,
	identifier, channel string,
) error {
	s.resetRequestCalls++
	s.gotIdentifier = identifier
	s.gotChannel = channel
	return s.resetRequestErr
}

func (s *handlerTestService) ResetPassword(
	_ context.Context,
	identifier, channel, code, newPassword string,
) error {
	s.resetCalls++
	s.gotIdentifier = identifier
	s.gotChannel = channel
	s.gotCode = code
	s.gotPassword = newPassword
	return s.resetErr
}

func newAuthHandlerRequest(
	handler http.HandlerFunc,
	body string,
) *httptest.ResponseRecorder {
	request := httptest.NewRequest(
		http.MethodPost,
		"/",
		strings.NewReader(body),
	)
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	handler(recorder, request)
	return recorder
}

func TestRequestEmailVerification(t *testing.T) {
	service := &handlerTestService{}
	handler := NewHandler(service)

	t.Run("rejects missing email", func(t *testing.T) {
		recorder := newAuthHandlerRequest(
			handler.RequestEmailVerification,
			`{}`,
		)

		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
		}

		if service.emailRequestCalls != 0 {
			t.Fatal("service should not be called for an invalid request")
		}
	})

	t.Run("accepts valid request", func(t *testing.T) {
		recorder := newAuthHandlerRequest(
			handler.RequestEmailVerification,
			`{"email":"patient@example.com"}`,
		)

		if recorder.Code != http.StatusAccepted {
			t.Fatalf("expected status %d, got %d", http.StatusAccepted, recorder.Code)
		}

		if service.emailRequestCalls != 1 {
			t.Fatalf("expected one service call, got %d", service.emailRequestCalls)
		}

		if service.gotEmail != "patient@example.com" {
			t.Fatalf("unexpected email forwarded: %q", service.gotEmail)
		}
	})
}

func TestVerifyEmailMapsChallengeErrors(t *testing.T) {
	tests := []struct {
		name       string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "invalid code",
			serviceErr: ErrInvalidChallengeCode,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "expired code",
			serviceErr: ErrChallengeExpired,
			wantStatus: http.StatusGone,
		},
		{
			name:       "attempt limit exceeded",
			serviceErr: ErrChallengeAttemptsExceeded,
			wantStatus: http.StatusTooManyRequests,
		},
		{
			name:       "consumed code",
			serviceErr: ErrChallengeConsumed,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &handlerTestService{emailVerifyErr: tt.serviceErr}
			handler := NewHandler(service)

			recorder := newAuthHandlerRequest(
				handler.VerifyEmail,
				`{"email":"patient@example.com","code":"123456"}`,
			)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d", tt.wantStatus, recorder.Code)
			}

			if service.emailVerifyCalls != 1 {
				t.Fatalf("expected one service call, got %d", service.emailVerifyCalls)
			}
		})
	}
}

func TestRequestPhoneVerification(t *testing.T) {
	service := &handlerTestService{}
	handler := NewHandler(service)

	recorder := newAuthHandlerRequest(
		handler.RequestPhoneVerification,
		`{"phoneNumber":"+2348012345678"}`,
	)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected status %d, got %d", http.StatusAccepted, recorder.Code)
	}

	if service.phoneRequestCalls != 1 {
		t.Fatalf("expected one service call, got %d", service.phoneRequestCalls)
	}

	if service.gotPhone != "+2348012345678" {
		t.Fatalf("unexpected phone forwarded: %q", service.gotPhone)
	}
}

func TestVerifyPhoneMapsExpiredChallenge(t *testing.T) {
	service := &handlerTestService{phoneVerifyErr: ErrChallengeExpired}
	handler := NewHandler(service)

	recorder := newAuthHandlerRequest(
		handler.VerifyPhone,
		`{"phoneNumber":"+2348012345678","code":"123456"}`,
	)

	if recorder.Code != http.StatusGone {
		t.Fatalf("expected status %d, got %d", http.StatusGone, recorder.Code)
	}

	if service.phoneVerifyCalls != 1 {
		t.Fatalf("expected one service call, got %d", service.phoneVerifyCalls)
	}
}

func TestRequestPasswordReset(t *testing.T) {
	service := &handlerTestService{}
	handler := NewHandler(service)

	t.Run("rejects unsupported channel", func(t *testing.T) {
		recorder := newAuthHandlerRequest(
			handler.RequestPasswordReset,
			`{"identifier":"patient@example.com","channel":"whatsapp"}`,
		)

		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
		}

		if service.resetRequestCalls != 0 {
			t.Fatal("service should not be called for an unsupported channel")
		}
	})

	t.Run("normalizes valid request", func(t *testing.T) {
		recorder := newAuthHandlerRequest(
			handler.RequestPasswordReset,
			`{"identifier":" patient@example.com ","channel":" EMAIL "}`,
		)

		if recorder.Code != http.StatusAccepted {
			t.Fatalf("expected status %d, got %d", http.StatusAccepted, recorder.Code)
		}

		if service.resetRequestCalls != 1 {
			t.Fatalf("expected one service call, got %d", service.resetRequestCalls)
		}

		if service.gotIdentifier != "patient@example.com" {
			t.Fatalf("unexpected identifier: %q", service.gotIdentifier)
		}

		if service.gotChannel != "email" {
			t.Fatalf("expected normalized channel email, got %q", service.gotChannel)
		}
	})
}

func TestResetPassword(t *testing.T) {
	service := &handlerTestService{}
	handler := NewHandler(service)

	t.Run("rejects invalid code before service call", func(t *testing.T) {
		recorder := newAuthHandlerRequest(
			handler.ResetPassword,
			`{
				"identifier":"patient@example.com",
				"channel":"email",
				"code":"12",
				"newPassword":"NewStrongPassword123!"
			}`,
		)

		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
		}

		if service.resetCalls != 0 {
			t.Fatal("service should not be called for an invalid code")
		}
	})

	t.Run("forwards valid reset request", func(t *testing.T) {
		recorder := newAuthHandlerRequest(
			handler.ResetPassword,
			`{
				"identifier":" patient@example.com ",
				"channel":" EMAIL ",
				"code":"123456",
				"newPassword":"NewStrongPassword123!"
			}`,
		)

		if recorder.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
		}

		if service.resetCalls != 1 {
			t.Fatalf("expected one service call, got %d", service.resetCalls)
		}

		if service.gotIdentifier != "patient@example.com" {
			t.Fatalf("unexpected identifier: %q", service.gotIdentifier)
		}

		if service.gotChannel != "email" {
			t.Fatalf("expected normalized channel email, got %q", service.gotChannel)
		}

		if service.gotCode != "123456" {
			t.Fatalf("unexpected code forwarded: %q", service.gotCode)
		}

		if service.gotPassword != "NewStrongPassword123!" {
			t.Fatal("new password was not forwarded correctly")
		}
	})
}
