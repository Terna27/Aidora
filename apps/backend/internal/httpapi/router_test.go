package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
	"github.com/Terna27/Aidora/apps/backend/internal/auth"
	"github.com/Terna27/Aidora/apps/backend/internal/emergency"
)

const (
	testToken     = "valid-token"
	testPatientID = "patient-123"
	emergencyPath = "/api/v1/emergencies"
)

// fakeAuthenticator is a test double for auth.Authenticator.
type fakeAuthenticator struct {
	principal auth.Principal
	err       error

	callCount     int
	receivedToken string
}

var (
	_ auth.Authenticator         = (*fakeAuthenticator)(nil)
	_ emergency.EmergencyCreator = (*fakeCreator)(nil)
)

func (f *fakeAuthenticator) Authenticate(ctx context.Context, accessToken string) (auth.Principal, error) {
	f.callCount++
	f.receivedToken = accessToken

	return f.principal, f.err
}

// fakeCreator is a test double for emergency.EmergencyCreator.
type fakeCreator struct {
	result emergency.CreateResult
	err    error

	callCount      int
	gotPatientID   string
	gotIdempotency string
}

type fakeAuthService struct{}

var _ auth.AuthService = (*fakeAuthService)(nil)

func (f *fakeAuthService) Register(
	ctx context.Context,
	input auth.RegisterInput,
) (auth.PublicUser, error) {
	return auth.PublicUser{}, nil
}

func (f *fakeAuthService) Login(
	ctx context.Context,
	input auth.LoginInput,
) (auth.TokenPair, error) {
	return auth.TokenPair{}, nil
}

func (f *fakeAuthService) Refresh(
	ctx context.Context,
	refreshToken string,
) (auth.TokenPair, error) {
	return auth.TokenPair{}, nil
}

func (f *fakeAuthService) Logout(
	ctx context.Context,
	refreshToken string,
) error {
	return nil
}

func (f *fakeAuthService) CurrentUser(
	ctx context.Context,
	userID string,
) (auth.PublicUser, error) {
	return auth.PublicUser{}, nil
}

func (f *fakeAuthService) RequestEmailVerification(
	ctx context.Context,
	email string,
) error {
	return nil
}

func (f *fakeAuthService) VerifyEmail(
	ctx context.Context,
	email string,
	code string,
) error {
	return nil
}

func (f *fakeAuthService) RequestPhoneVerification(
	ctx context.Context,
	phone string,
) error {
	return nil
}

func (f *fakeAuthService) VerifyPhone(
	ctx context.Context,
	phone string,
	code string,
) error {
	return nil
}

func (f *fakeCreator) Create(
	ctx context.Context,
	patientID string,
	idempotencyKey string,
	request emergency.CreateRequest,
) (emergency.CreateResult, error) {
	f.callCount++
	f.gotPatientID = patientID
	f.gotIdempotency = idempotencyKey

	return f.result, f.err
}

func newTestRouter(
	t *testing.T,
	authenticator auth.Authenticator,
	creator emergency.EmergencyCreator,
) http.Handler {
	t.Helper()

	authHandler := auth.NewHandler(&fakeAuthService{})

	router, err := NewRouter(
		authenticator,
		authHandler,
		emergency.NewHandler(creator),
	)
	if err != nil {
		t.Fatalf("NewRouter() error = %v", err)
	}

	return router
}

func newEmergencyRequest(authorization string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, emergencyPath, strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "key-abc")

	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}

	return req
}

func decodeResponse(t *testing.T, rec *httptest.ResponseRecorder) api.Response {
	t.Helper()

	var resp api.Response
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	return resp
}

func acceptedCreator() *fakeCreator {
	return &fakeCreator{
		result: emergency.CreateResult{
			Status: http.StatusAccepted,
			Data:   json.RawMessage(`{"id":"emg-123"}`),
		},
	}
}

func TestRouter_Health_IsPublic(t *testing.T) {
	authenticator := &fakeAuthenticator{err: errors.New("should not be called")}
	router := newTestRouter(t, authenticator, &fakeCreator{})

	req := httptest.NewRequest(http.MethodGet, "/health", nil) // no Authorization header
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	if authenticator.callCount != 0 {
		t.Errorf("Authenticate called %d times, want 0", authenticator.callCount)
	}

	resp := decodeResponse(t, rec)

	if !resp.Success {
		t.Error("success = false, want true")
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data = %v, want an object", resp.Data)
	}

	if data["status"] != "ok" {
		t.Errorf("data status = %v, want %q", data["status"], "ok")
	}
}

func TestRouter_Emergencies_RejectsUnauthenticated(t *testing.T) {
	tests := []struct {
		name              string
		authorization     string
		authenticator     *fakeAuthenticator
		wantAuthenticator bool
	}{
		{
			name:              "missing bearer token returns 401",
			authorization:     "",
			authenticator:     &fakeAuthenticator{principal: auth.Principal{UserID: testPatientID}},
			wantAuthenticator: false,
		},
		{
			name:              "invalid token returns 401",
			authorization:     "Bearer invalid-token",
			authenticator:     &fakeAuthenticator{err: errors.New("invalid token")},
			wantAuthenticator: true,
		},
		{
			name:              "missing bearer scheme returns 401",
			authorization:     testToken,
			authenticator:     &fakeAuthenticator{principal: auth.Principal{UserID: testPatientID}},
			wantAuthenticator: false,
		},
		{
			name:              "wrong authentication scheme returns 401",
			authorization:     "Basic " + testToken,
			authenticator:     &fakeAuthenticator{principal: auth.Principal{UserID: testPatientID}},
			wantAuthenticator: false,
		},
		{
			name:              "empty bearer token returns 401",
			authorization:     "Bearer ",
			authenticator:     &fakeAuthenticator{principal: auth.Principal{UserID: testPatientID}},
			wantAuthenticator: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			creator := acceptedCreator()
			router := newTestRouter(t, tt.authenticator, creator)

			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, newEmergencyRequest(tt.authorization))

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
			}

			if got := (tt.authenticator.callCount > 0); got != tt.wantAuthenticator {
				t.Errorf("authenticator called = %v, want %v", got, tt.wantAuthenticator)
			}

			if creator.callCount != 0 {
				t.Errorf("emergency service called %d times, want 0", creator.callCount)
			}

			resp := decodeResponse(t, rec)

			if resp.Success {
				t.Error("success = true, want false")
			}

			if resp.Error == nil || resp.Error.Code != "UNAUTHENTICATED" {
				t.Errorf("error = %+v, want code %q", resp.Error, "UNAUTHENTICATED")
			}
		})
	}
}

func TestRouter_Emergencies_ValidTokenReachesHandler(t *testing.T) {
	authenticator := &fakeAuthenticator{principal: auth.Principal{UserID: testPatientID}}
	creator := acceptedCreator()
	router := newTestRouter(t, authenticator, creator)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, newEmergencyRequest("Bearer "+testToken))

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d (body: %s)", rec.Code, http.StatusAccepted, rec.Body.String())
	}

	if authenticator.callCount != 1 {
		t.Errorf("Authenticate called %d times, want 1", authenticator.callCount)
	}

	if authenticator.receivedToken != testToken {
		t.Errorf("authenticator received token %q, want %q", authenticator.receivedToken, testToken)
	}

	if creator.callCount != 1 {
		t.Fatalf("emergency service called %d times, want 1", creator.callCount)
	}

	resp := decodeResponse(t, rec)

	if !resp.Success {
		t.Error("success = false, want true")
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data = %v, want an object", resp.Data)
	}

	if data["id"] != "emg-123" {
		t.Errorf("emergency ID = %v, want %q", data["id"], "emg-123")
	}
}

func TestRouter_Emergencies_ForwardsAuthenticatedIdentity(t *testing.T) {
	authenticator := &fakeAuthenticator{principal: auth.Principal{UserID: testPatientID}}
	creator := acceptedCreator()
	router := newTestRouter(t, authenticator, creator)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, newEmergencyRequest("Bearer "+testToken))

	if creator.callCount != 1 {
		t.Fatalf("emergency service called %d times, want 1 (status %d, body: %s)",
			creator.callCount, rec.Code, rec.Body.String())
	}

	if creator.gotPatientID != testPatientID {
		t.Errorf("patientID = %q, want %q", creator.gotPatientID, testPatientID)
	}

	if creator.gotIdempotency != "key-abc" {
		t.Errorf("idempotency key = %q, want %q", creator.gotIdempotency, "key-abc")
	}
}

func TestNewRouter_RequiresDependencies(t *testing.T) {
	authHandler := auth.NewHandler(&fakeAuthService{})
	emergencyHandler := emergency.NewHandler(&fakeCreator{})
	authenticator := &fakeAuthenticator{}

	tests := []struct {
		name          string
		authenticator auth.Authenticator
		authHandler   *auth.Handler
		emergency     *emergency.Handler
	}{
		{
			name:          "nil authenticator",
			authenticator: nil,
			authHandler:   authHandler,
			emergency:     emergencyHandler,
		},
		{
			name:          "nil auth handler",
			authenticator: authenticator,
			authHandler:   nil,
			emergency:     emergencyHandler,
		},
		{
			name:          "nil emergency handler",
			authenticator: authenticator,
			authHandler:   authHandler,
			emergency:     nil,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := NewRouter(
				test.authenticator,
				test.authHandler,
				test.emergency,
			)

			if err == nil {
				t.Fatal("NewRouter() error = nil, want error")
			}
		})
	}
}

func TestRouter_Emergencies_RejectsEmptyAuthenticatedIdentity(t *testing.T) {
	authenticator := &fakeAuthenticator{
		principal: auth.Principal{UserID: "   "},
	}
	creator := acceptedCreator()
	router := newTestRouter(t, authenticator, creator)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, newEmergencyRequest("Bearer "+testToken))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}

	if authenticator.callCount != 1 {
		t.Errorf("Authenticate called %d times, want 1", authenticator.callCount)
	}

	if creator.callCount != 0 {
		t.Errorf("emergency service called %d times, want 0", creator.callCount)
	}
}
