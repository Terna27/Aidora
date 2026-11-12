package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeAuthenticator is a test double for Authenticator.
// It returns a preconfigured result and records how it was called.
type fakeAuthenticator struct {
	principal Principal
	err       error

	called        bool
	callCount     int
	receivedToken string
}

func (f *fakeAuthenticator) Authenticate(ctx context.Context, accessToken string) (Principal, error) {
	f.called = true
	f.callCount++
	f.receivedToken = accessToken

	return f.principal, f.err
}

func TestMiddleware_ValidTokenAndUserID_CallsHandler(t *testing.T) {
	authenticator := &fakeAuthenticator{
		principal: Principal{UserID: "user-123"},
	}

	handlerCalled := false
	var gotPrincipal Principal
	var gotOK bool

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		gotPrincipal, gotOK = PrincipalFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(authenticator)(next)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if !handlerCalled {
		t.Fatal("expected next handler to be called")
	}

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	if !authenticator.called {
		t.Error("expected authenticator to be called")
	}

	if authenticator.receivedToken != "valid-token" {
		t.Errorf("authenticator received token %q, want %q", authenticator.receivedToken, "valid-token")
	}

	if !gotOK {
		t.Fatal("expected principal to be present in request context")
	}

	if gotPrincipal.UserID != "user-123" {
		t.Errorf("principal UserID = %q, want %q", gotPrincipal.UserID, "user-123")
	}

	if authenticator.callCount != 1 {
		t.Errorf("Authenticate called %d times, want 1", authenticator.callCount)
	}
}

func TestMiddleware_Unauthenticated(t *testing.T) {
	tests := []struct {
		name              string
		authorization     string // empty means the header is not set
		authenticator     *fakeAuthenticator
		wantStatus        int
		wantAuthenticator bool
		wantToken         string // only checked when the authenticator should run
	}{
		{
			name:              "missing Authorization header",
			authorization:     "",
			authenticator:     &fakeAuthenticator{principal: Principal{UserID: "user-123"}},
			wantStatus:        http.StatusUnauthorized,
			wantAuthenticator: false,
		},
		{
			name:              "malformed header (Basic token)",
			authorization:     "Basic token",
			authenticator:     &fakeAuthenticator{principal: Principal{UserID: "user-123"}},
			wantStatus:        http.StatusUnauthorized,
			wantAuthenticator: false,
		},
		{
			name:              "invalid bearer token",
			authorization:     "Bearer invalid-token",
			authenticator:     &fakeAuthenticator{err: errors.New("invalid token")},
			wantStatus:        http.StatusUnauthorized,
			wantAuthenticator: true,
			wantToken:         "invalid-token",
		},
		{
			name:              "empty user ID",
			authorization:     "Bearer valid-token",
			authenticator:     &fakeAuthenticator{principal: Principal{UserID: ""}},
			wantStatus:        http.StatusUnauthorized,
			wantAuthenticator: true,
			wantToken:         "valid-token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handlerCalled := false

			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				handlerCalled = true
				w.WriteHeader(http.StatusOK)
			})

			handler := Middleware(tt.authenticator)(next)

			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			if tt.authorization != "" {
				req.Header.Set("Authorization", tt.authorization)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}

			if handlerCalled {
				t.Error("next handler must not be called")
			}

			if tt.authenticator.called != tt.wantAuthenticator {
				t.Errorf("authenticator called = %v, want %v", tt.authenticator.called, tt.wantAuthenticator)
			}

			if tt.wantAuthenticator {
				if tt.authenticator.callCount != 1 {
					t.Errorf("Authenticate called %d times, want 1", tt.authenticator.callCount)
				}
				if tt.authenticator.receivedToken != tt.wantToken {
					t.Errorf("authenticator received token %q, want %q", tt.authenticator.receivedToken, tt.wantToken)
				}
			} else if tt.authenticator.callCount != 0 {
				t.Errorf("Authenticate called %d times, want 0", tt.authenticator.callCount)
			}

			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want %q", got, "application/json")
			}

			var body struct {
				Success bool `json:"success"`
				Error   struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error"`
			}
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("failed to decode response body: %v", err)
			}

			if body.Success {
				t.Error("success = true, want false")
			}

			if body.Error.Code != "UNAUTHENTICATED" {
				t.Errorf("error code = %q, want %q", body.Error.Code, "UNAUTHENTICATED")
			}
		})
	}
}
