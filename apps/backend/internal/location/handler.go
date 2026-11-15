package location

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
	"github.com/go-chi/chi/v5"
)

const maxLocationRequestBodySize = 1 << 20

type LocationService interface {
    SavePatientLocation(
        ctx context.Context,
        emergencyID string,
        patientID string,
        update LocationUpdate,
    ) (Location, error)

    SaveResponderLocation(
        ctx context.Context,
        emergencyID string,
        responderID string,
        update LocationUpdate,
    ) (Location, error)

    GetSnapshot(
        ctx context.Context,
        emergencyID string,
        requesterID string,
    ) (LocationSnapshot, error)
}

type Handler struct {
    service LocationService
}

func NewHandler(service LocationService) *Handler {
    return &Handler{service: service}
}

func (h *Handler) SavePatientLocation(w http.ResponseWriter, r *http.Request) {
    principal, ok := auth.PrincipalFromContext(r.Context())
    if !ok {
        writeLocationError(w, http.StatusUnauthorized,
            "UNAUTHENTICATED", "Authentication is required.")
        return
    }

    update, ok := decodeLocationRequest(w, r)
    if !ok {
        return
    }

    result, err := h.service.SavePatientLocation(
        r.Context(),
        chi.URLParam(r, "id"),
        principal.UserID,
        update,
    )
    if err != nil {
        writeLocationServiceError(w, err)
        return
    }

    if err := api.WriteSuccess(w, http.StatusCreated, result); err != nil {
        log.Printf("failed to write patient location response: %v", err)
    }
}

func (h *Handler) SaveResponderLocation(w http.ResponseWriter, r *http.Request) {
    principal, ok := auth.PrincipalFromContext(r.Context())
    if !ok {
        writeLocationError(w, http.StatusUnauthorized,
            "UNAUTHENTICATED", "Authentication is required.")
        return
    }

    update, ok := decodeLocationRequest(w, r)
    if !ok {
        return
    }

    result, err := h.service.SaveResponderLocation(
        r.Context(),
        chi.URLParam(r, "id"),
        principal.UserID,
        update,
    )
    if err != nil {
        writeLocationServiceError(w, err)
        return
    }

    if err := api.WriteSuccess(w, http.StatusCreated, result); err != nil {
        log.Printf("failed to write responder location response: %v", err)
    }
}

func (h *Handler) GetLocations(w http.ResponseWriter, r *http.Request) {
    principal, ok := auth.PrincipalFromContext(r.Context())
    if !ok {
        writeLocationError(w, http.StatusUnauthorized,
            "UNAUTHENTICATED", "Authentication is required.")
        return
    }

    result, err := h.service.GetSnapshot(
        r.Context(),
        chi.URLParam(r, "id"),
        principal.UserID,
    )
    if err != nil {
        writeLocationServiceError(w, err)
        return
    }

    if err := api.WriteSuccess(w, http.StatusOK, result); err != nil {
        log.Printf("failed to write location snapshot response: %v", err)
    }
}

func decodeLocationRequest(w http.ResponseWriter, r *http.Request) (LocationUpdate, bool) {
    r.Body = http.MaxBytesReader(w, r.Body, maxLocationRequestBodySize)
    defer r.Body.Close()

    decoder := json.NewDecoder(r.Body)

    var raw json.RawMessage
    if err := decoder.Decode(&raw); err != nil {
        var maxBytesErr *http.MaxBytesError
        if errors.As(err, &maxBytesErr) {
            writeLocationError(w, http.StatusRequestEntityTooLarge,
                "REQUEST_BODY_TOO_LARGE", "Request body exceeds the maximum allowed size.")
            return LocationUpdate{}, false
        }

        writeLocationError(w, http.StatusBadRequest,
            "INVALID_REQUEST_BODY", "Request body must contain valid JSON.")
        return LocationUpdate{}, false
    }

    body := strings.TrimSpace(string(raw))
    if len(body) == 0 || body[0] != '{' {
        writeLocationError(w, http.StatusBadRequest,
            "INVALID_REQUEST_BODY", "Request body must be a JSON object.")
        return LocationUpdate{}, false
    }

    var extra json.RawMessage
    if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
        writeLocationError(w, http.StatusBadRequest,
            "INVALID_REQUEST_BODY", "Request body must contain exactly one JSON object.")
        return LocationUpdate{}, false
    }

    var update LocationUpdate
    requestDecoder := json.NewDecoder(strings.NewReader(body))
    requestDecoder.DisallowUnknownFields()

    if err := requestDecoder.Decode(&update); err != nil {
        writeLocationError(w, http.StatusBadRequest,
            "INVALID_REQUEST_BODY", "Request body contains invalid or unsupported fields.")
        return LocationUpdate{}, false
    }

    if err := ValidateLocationUpdate(update); err != nil {
        writeLocationError(w, http.StatusBadRequest,
            "INVALID_LOCATION", "The supplied location is invalid.")
        return LocationUpdate{}, false
    }

    return update, true
}

func writeLocationServiceError(w http.ResponseWriter, err error) {
    switch {
    case errors.Is(err, ErrInvalidLocation):
        writeLocationError(w, http.StatusBadRequest,
            "INVALID_LOCATION", "The supplied location is invalid.")

    case errors.Is(err, ErrLocationAccessDenied):
        writeLocationError(w, http.StatusForbidden,
            "LOCATION_ACCESS_DENIED", "You are not authorized to access or update this emergency location.")

    case errors.Is(err, ErrEmergencyNotFound):
        writeLocationError(w, http.StatusNotFound,
            "EMERGENCY_NOT_FOUND", "The requested emergency was not found.")

    default:
        log.Printf("location operation failed: %v", err)
        writeLocationError(w, http.StatusInternalServerError,
            "INTERNAL_ERROR", "An unexpected error occurred.")
    }
}

func writeLocationError(w http.ResponseWriter, status int, code, message string) {
    _ = api.WriteError(w, status, code, message, nil)
}
