package emergency

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
	"github.com/Terna27/Aidora/apps/backend/internal/auth"
)

const maxRequestBodySize = 1 << 20 // 1 MB

// EmergencyCreator defines the service operation required by the handler.
type EmergencyCreator interface {
	Create(
		ctx context.Context,
		patientID string,
		idempotencyKey string,
		request CreateRequest,
	) (CreateResult, error)
}

// Handler handles emergency HTTP requests.
type Handler struct {
	service EmergencyCreator
}

func NewHandler(service EmergencyCreator) *Handler {
	return &Handler{
		service: service,
	}
}

// Create handles POST /api/v1/emergencies.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	// 1. Require an authenticated principal.
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		writeHandlerError(
			w,
			http.StatusUnauthorized,
			"UNAUTHENTICATED",
			"Authentication is required.",
		)
		return
	}

	// 2. Require exactly one non-empty Idempotency-Key header.
	keys := r.Header.Values("Idempotency-Key")

	if len(keys) != 1 || strings.TrimSpace(keys[0]) == "" {
		writeHandlerError(
			w,
			http.StatusBadRequest,
			"INVALID_IDEMPOTENCY_KEY",
			"Exactly one non-empty Idempotency-Key header is required.",
		)
		return
	}

	idempotencyKey := strings.TrimSpace(keys[0])

	// 3. Limit the request body to 1 MB.
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)
	defer r.Body.Close()

	// 4. Decode the JSON into RawMessage first.
	// This lets us reject null, arrays, strings, and other non-object values.
	decoder := json.NewDecoder(r.Body)

	var rawBody json.RawMessage

	if err := decoder.Decode(&rawBody); err != nil {
		var maxBytesErr *http.MaxBytesError

		if errors.As(err, &maxBytesErr) {
			writeHandlerError(
				w,
				http.StatusRequestEntityTooLarge,
				"REQUEST_BODY_TOO_LARGE",
				"Request body exceeds the maximum allowed size.",
			)
			return
		}

		writeHandlerError(
			w,
			http.StatusBadRequest,
			"INVALID_REQUEST_BODY",
			"Request body must contain valid JSON.",
		)
		return
	}

	trimmedBody := strings.TrimSpace(string(rawBody))

	if len(trimmedBody) == 0 || trimmedBody[0] != '{' {
		writeHandlerError(
			w,
			http.StatusBadRequest,
			"INVALID_REQUEST_BODY",
			"Request body must be a JSON object.",
		)
		return
	}

	// 5. Reject additional JSON values after the first object.
	var extra json.RawMessage

	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		writeHandlerError(
			w,
			http.StatusBadRequest,
			"INVALID_REQUEST_BODY",
			"Request body must contain exactly one JSON object.",
		)
		return
	}

	// 6. Decode the object into CreateRequest and reject unknown fields.
	var request CreateRequest

	requestDecoder := json.NewDecoder(strings.NewReader(trimmedBody))
	requestDecoder.DisallowUnknownFields()

	if err := requestDecoder.Decode(&request); err != nil {
		writeHandlerError(
			w,
			http.StatusBadRequest,
			"INVALID_REQUEST_BODY",
			"Request body contains invalid or unsupported fields.",
		)
		return
	}

	// 7. Call the service using the authenticated patient ID.
	result, err := h.service.Create(
		r.Context(),
		principal.UserID,
		idempotencyKey,
		request,
	)

	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidLocation):
			writeHandlerError(
				w,
				http.StatusBadRequest,
				"INVALID_PICKUP_LOCATION",
				"The pickup location is invalid.",
			)

		case errors.Is(err, ErrPatientRoleRequired):
			writeHandlerError(
				w,
				http.StatusForbidden,
				"PATIENT_ROLE_REQUIRED",
				"A patient account is required to create an emergency.",
			)

		case errors.Is(err, ErrActiveEmergency):
			writeHandlerError(
				w,
				http.StatusConflict,
				"ACTIVE_EMERGENCY_EXISTS",
				"An active emergency already exists.",
			)

		case errors.Is(err, ErrIdempotencyConflict):
			writeHandlerError(
				w,
				http.StatusConflict,
				"IDEMPOTENCY_CONFLICT",
				"This Idempotency-Key was already used with a different request.",
			)

		default:
			// Log the actual error internally, but do not expose it to the client.
			log.Printf("failed to create emergency: %v", err)

			writeHandlerError(
				w,
				http.StatusInternalServerError,
				"INTERNAL_ERROR",
				"An unexpected error occurred.",
			)
		}

		return
	}

	// 8. Return the service's success status and response data.
	if err := api.WriteSuccess(w, result.Status, result.Data); err != nil {
		log.Printf("failed to write emergency response: %v", err)
	}
}

func writeHandlerError(
	w http.ResponseWriter,
	status int,
	code string,
	message string,
) {
	_ = api.WriteError(w, status, code, message, nil)
}
