package responder

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/Terna27/Aidora/apps/backend/internal/api"
	"github.com/Terna27/Aidora/apps/backend/internal/auth"
	"io"
	"log"
	"net/http"
)

const maxApplicationBodySize = 1 << 20

func decodeApplicationRequest(
	w http.ResponseWriter,
	r *http.Request,
) (ApplicationRequest, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxApplicationBodySize)
	defer r.Body.Close()

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	var request ApplicationRequest
	if err := decoder.Decode(&request); err != nil {
		return ApplicationRequest{}, err
	}

	// Reject additional JSON values after the request object.
	if err := decoder.Decode(new(json.RawMessage)); err != io.EOF {
		return ApplicationRequest{}, errors.New("request must contain exactly one JSON object")
	}

	// Reject null, arrays and other non-object JSON values.
	body, err := json.Marshal(request)
	if err != nil {
		return ApplicationRequest{}, err
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return ApplicationRequest{}, errors.New("empty request")
	}

	return request, nil
}

type ApplicationService interface {
	Apply(
		ctx context.Context,
		userID string,
		request ApplicationRequest,
	) (ApplicationResult, error)
}

type Handler struct {
	service ApplicationService
}

func NewHandler(service ApplicationService) *Handler {
	return &Handler{service: service}
}

func (handler *Handler) Apply(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		_ = api.WriteError(
			w,
			http.StatusUnauthorized,
			"UNAUTHENTICATED",
			"Authentication is required.",
			nil,
		)
		return
	}

	request, err := decodeApplicationRequest(w, r)
	if err != nil {
		_ = api.WriteError(
			w,
			http.StatusBadRequest,
			"INVALID_RESPONDER_APPLICATION",
			"Request body contains invalid or unsupported fields.",
			nil,
		)
		return
	}

	result, err := handler.service.Apply(r.Context(), principal.UserID, request)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidApplication),
			errors.Is(err, ErrInvalidServiceDescription):
			_ = api.WriteError(
				w,
				http.StatusBadRequest,
				"INVALID_RESPONDER_APPLICATION",
				"The responder application details are invalid.",
				nil,
			)

		case errors.Is(err, ErrUserNotFound):
			_ = api.WriteError(
				w,
				http.StatusUnauthorized,
				"ACCOUNT_NOT_FOUND",
				"The account could not be found.",
				nil,
			)

		case errors.Is(err, ErrPatientRoleRequired):
			_ = api.WriteError(
				w,
				http.StatusForbidden,
				"PATIENT_ROLE_REQUIRED",
				"A patient account is required to apply as a responder.",
				nil,
			)

		case errors.Is(err, ErrAlreadyApplied):
			_ = api.WriteError(
				w,
				http.StatusConflict,
				"RESPONDER_APPLICATION_EXISTS",
				"A responder application already exists for this account.",
				nil,
			)

		case errors.Is(err, ErrInvalidResponderType):
			_ = api.WriteError(
				w,
				http.StatusBadRequest,
				"INVALID_RESPONDER_TYPE",
				"One or more selected responder types are unavailable.",
				nil,
			)

		default:
			log.Printf("failed to create responder application: %v", err)
			_ = api.WriteError(
				w,
				http.StatusInternalServerError,
				"INTERNAL_ERROR",
				"An unexpected error occurred.",
				nil,
			)
		}
		return
	}

	if err := api.WriteSuccess(w, http.StatusCreated, result); err != nil {
		log.Printf("failed to write responder application response: %v", err)
	}
}
