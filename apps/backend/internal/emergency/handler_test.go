package emergency

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
)

// fakeCreator is a test double for EmergencyCreator.
type fakeCreator struct {
	result CreateResult
	err    error

	callCount      int
	gotPatientID   string
	gotIdempotency string
	gotRequest     CreateRequest
}

func (f *fakeCreator) Create(
	ctx context.Context,
	patientID string,
	idempotencyKey string,
	request CreateRequest,
) (CreateResult, error) {
	f.callCount++
	f.gotPatientID = patientID
	f.gotIdempotency = idempotencyKey
	f.gotRequest = request

	return f.result, f.err
}

var _ EmergencyCreator = (*fakeCreator)(nil)

const testPatientID = "patient-123"

// newRequest builds a POST request. Pass withPrincipal=false to simulate
// a request that never went through the auth middleware.
func newRequest(t *testing.T, body string, idempotencyKeys []string, withPrincipal bool) *http.Request {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/emergencies", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	for _, key := range idempotencyKeys {
		req.Header.Add("Idempotency-Key", key)
	}

	if withPrincipal {
		ctx := auth.WithPrincipal(req.Context(), auth.Principal{UserID: testPatientID})
		req = req.WithContext(ctx)
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

func TestHandler_Create_Success(t *testing.T) {
	service := &fakeCreator{
		result: CreateResult{
			Status: http.StatusAccepted,
			Data:   json.RawMessage(`{"id":"emg-123"}`),
		},
	}

	handler := NewHandler(service)

	body := `{
		"source": "MANUAL",
		"villageCommunity": "Wadata"
	}`

	req := newRequest(t, body, []string{"  key-abc  "}, true)
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf(
			"status = %d, want %d (body: %s)",
			rec.Code,
			http.StatusAccepted,
			rec.Body.String(),
		)
	}

	if service.callCount != 1 {
		t.Fatalf("service called %d times, want 1", service.callCount)
	}

	if service.gotPatientID != testPatientID {
		t.Errorf("patientID = %q, want %q", service.gotPatientID, testPatientID)
	}

	if service.gotIdempotency != "key-abc" {
		t.Errorf("idempotency key = %q, want %q", service.gotIdempotency, "key-abc")
	}

	if service.gotRequest.Source != LocationSourceManual {
		t.Errorf(
			"source = %q, want %q",
			service.gotRequest.Source,
			LocationSourceManual,
		)
	}

	if service.gotRequest.VillageCommunity == nil {
		t.Fatal("villageCommunity is nil, want it present")
	}

	if *service.gotRequest.VillageCommunity != "Wadata" {
		t.Errorf(
			"villageCommunity = %q, want %q",
			*service.gotRequest.VillageCommunity,
			"Wadata",
		)
	}

	resp := decodeResponse(t, rec)

	if !resp.Success {
		t.Error("success = false, want true")
	}

	if resp.Data == nil {
		t.Error("data is missing, want it present")
	}

	if resp.Error != nil {
		t.Errorf("error = %+v, want nil", resp.Error)
	}
}

func TestHandler_Create_Errors(t *testing.T) {
	tests := []struct {
		name            string
		withPrincipal   bool
		idempotencyKeys []string
		body            string
		serviceErr      error
		wantStatus      int
		wantCode        string
		wantServiceCall bool
	}{
		{
			name:            "missing principal returns 401",
			withPrincipal:   false,
			idempotencyKeys: []string{"key-1"},
			body:            `{}`,
			wantStatus:      http.StatusUnauthorized,
			wantCode:        "UNAUTHENTICATED",
			wantServiceCall: false,
		},
		{
			name:            "missing Idempotency-Key returns 400",
			withPrincipal:   true,
			idempotencyKeys: nil,
			body:            `{}`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_IDEMPOTENCY_KEY",
			wantServiceCall: false,
		},
		{
			name:            "malformed JSON returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{"invalid":`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_REQUEST_BODY",
			wantServiceCall: false,
		},
		{
			name:            "unknown JSON field returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{"this_field_does_not_exist":"value"}`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_REQUEST_BODY",
			wantServiceCall: false,
		},
		{
			name:            "active emergency returns 409",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{}`,
			serviceErr:      ErrActiveEmergency,
			wantStatus:      http.StatusConflict,
			wantCode:        "ACTIVE_EMERGENCY_EXISTS",
			wantServiceCall: true,
		},
		{
			name:            "idempotency payload conflict returns 409",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{}`,
			serviceErr:      ErrIdempotencyConflict,
			wantStatus:      http.StatusConflict,
			wantCode:        "IDEMPOTENCY_CONFLICT",
			wantServiceCall: true,
		},
		{
			name:            "patient role missing returns 403",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{}`,
			serviceErr:      ErrPatientRoleRequired,
			wantStatus:      http.StatusForbidden,
			wantCode:        "PATIENT_ROLE_REQUIRED",
			wantServiceCall: true,
		},
		{
			name:            "empty idempotency key returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{""},
			body:            `{}`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_IDEMPOTENCY_KEY",
			wantServiceCall: false,
		},
		{
			name:            "whitespace idempotency key returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"   "},
			body:            `{}`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_IDEMPOTENCY_KEY",
			wantServiceCall: false,
		},
		{
			name:            "duplicate idempotency headers return 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1", "key-2"},
			body:            `{}`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_IDEMPOTENCY_KEY",
			wantServiceCall: false,
		},
		{
			name:            "empty body returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            "",
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_REQUEST_BODY",
			wantServiceCall: false,
		},
		{
			name:            "JSON null returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `null`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_REQUEST_BODY",
			wantServiceCall: false,
		},
		{
			name:            "JSON array returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `[]`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_REQUEST_BODY",
			wantServiceCall: false,
		},
		{
			name:            "multiple JSON values return 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{} {}`,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_REQUEST_BODY",
			wantServiceCall: false,
		},
		{
			name:            "invalid pickup location returns 400",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{}`,
			serviceErr:      ErrInvalidLocation,
			wantStatus:      http.StatusBadRequest,
			wantCode:        "INVALID_PICKUP_LOCATION",
			wantServiceCall: true,
		},
		{
			name:            "unexpected service error returns 500",
			withPrincipal:   true,
			idempotencyKeys: []string{"key-1"},
			body:            `{}`,
			serviceErr:      errors.New("database connection failed"),
			wantStatus:      http.StatusInternalServerError,
			wantCode:        "INTERNAL_ERROR",
			wantServiceCall: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &fakeCreator{err: tt.serviceErr}
			handler := NewHandler(service)

			req := newRequest(t, tt.body, tt.idempotencyKeys, tt.withPrincipal)
			rec := httptest.NewRecorder()

			handler.Create(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}

			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want %q", got, "application/json")
			}

			if tt.wantServiceCall && service.callCount != 1 {
				t.Errorf("service called %d times, want 1", service.callCount)
			}

			if !tt.wantServiceCall && service.callCount != 0 {
				t.Errorf("service called %d times, want 0", service.callCount)
			}

			resp := decodeResponse(t, rec)

			if resp.Success {
				t.Error("success = true, want false")
			}

			if resp.Error == nil {
				t.Fatal("error is missing, want it present")
			}

			if resp.Error.Code != tt.wantCode {
				t.Errorf("error code = %q, want %q", resp.Error.Code, tt.wantCode)
			}
		})
	}
}

// Wrapped sentinel errors must still map correctly because the handler uses errors.Is.
func TestHandler_Create_WrappedServiceError(t *testing.T) {
	service := &fakeCreator{
		err: errors.Join(errors.New("db lookup failed"), ErrActiveEmergency),
	}

	handler := NewHandler(service)

	req := newRequest(t, `{}`, []string{"key-1"}, true)
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusConflict)
	}

	resp := decodeResponse(t, rec)

	if resp.Error == nil {
		t.Fatal("error is missing, want it present")
	}

	if resp.Error.Code != "ACTIVE_EMERGENCY_EXISTS" {
		t.Errorf(
			"error code = %q, want %q",
			resp.Error.Code,
			"ACTIVE_EMERGENCY_EXISTS",
		)
	}
}

func TestHandler_Create_OversizedBody(t *testing.T) {
	service := &fakeCreator{}
	handler := NewHandler(service)

	body := `{"notes":"` + strings.Repeat("a", maxRequestBodySize) + `"}`

	req := newRequest(t, body, []string{"key-1"}, true)
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf(
			"status = %d, want %d (body: %s)",
			rec.Code,
			http.StatusRequestEntityTooLarge,
			rec.Body.String(),
		)
	}

	resp := decodeResponse(t, rec)

	if resp.Success {
		t.Error("success = true, want false")
	}

	if resp.Error == nil {
		t.Fatal("error is missing, want it present")
	}

	if resp.Error.Code != "REQUEST_BODY_TOO_LARGE" {
		t.Errorf(
			"error code = %q, want %q",
			resp.Error.Code,
			"REQUEST_BODY_TOO_LARGE",
		)
	}

	if service.callCount != 0 {
		t.Errorf("service called %d times, want 0", service.callCount)
	}
}
