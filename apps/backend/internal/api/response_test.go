package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	return body
}

func TestWriteSuccess(t *testing.T) {
	rec := httptest.NewRecorder()

	data := map[string]any{"id": "abc-123", "name": "Test"}

	if err := WriteSuccess(rec, http.StatusCreated, data); err != nil {
		t.Fatalf("WriteSuccess() error = %v", err)
	}

	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusCreated)
	}

	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want %q", got, "application/json")
	}

	if !strings.HasSuffix(rec.Body.String(), "\n") {
		t.Error("expected response body to end with a newline")
	}

	body := decodeBody(t, rec)

	if body["success"] != true {
		t.Errorf("success = %v, want true", body["success"])
	}

	if !reflect.DeepEqual(body["data"], data) {
		t.Errorf("data = %v, want %v", body["data"], data)
	}

	if _, ok := body["error"]; ok {
		t.Error("error field must be omitted on success")
	}
}

func TestWriteError(t *testing.T) {
	rec := httptest.NewRecorder()

	err := WriteError(rec, http.StatusBadRequest, "INVALID_INPUT", "Input is invalid", nil)
	if err != nil {
		t.Fatalf("WriteError() error = %v", err)
	}

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want %q", got, "application/json")
	}

	body := decodeBody(t, rec)

	if body["success"] != false {
		t.Errorf("success = %v, want false", body["success"])
	}

	if _, ok := body["data"]; ok {
		t.Error("data field must be omitted on error")
	}

	errObj, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("error = %v, want an object", body["error"])
	}

	if errObj["code"] != "INVALID_INPUT" {
		t.Errorf("error code = %v, want %q", errObj["code"], "INVALID_INPUT")
	}

	if errObj["message"] != "Input is invalid" {
		t.Errorf("error message = %v, want %q", errObj["message"], "Input is invalid")
	}
}

func TestWriteError_Details(t *testing.T) {
	tests := []struct {
		name        string
		details     map[string]any
		wantDetails bool
	}{
		{
			name:        "details included when provided",
			details:     map[string]any{"field": "email", "reason": "required"},
			wantDetails: true,
		},
		{
			name:        "nil details omitted",
			details:     nil,
			wantDetails: false,
		},
		{
			name:        "empty details omitted",
			details:     map[string]any{},
			wantDetails: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			err := WriteError(rec, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Validation failed", tt.details)
			if err != nil {
				t.Fatalf("WriteError() error = %v", err)
			}

			body := decodeBody(t, rec)

			errObj, ok := body["error"].(map[string]any)
			if !ok {
				t.Fatalf("error = %v, want an object", body["error"])
			}

			got, present := errObj["details"]

			if present != tt.wantDetails {
				t.Fatalf("details present = %v, want %v (body: %v)", present, tt.wantDetails, errObj)
			}

			if tt.wantDetails && !reflect.DeepEqual(got, map[string]any(tt.details)) {
				t.Errorf("details = %v, want %v", got, tt.details)
			}
		})
	}
}