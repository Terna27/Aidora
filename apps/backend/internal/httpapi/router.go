package httpapi

import (
	"errors"
	"log"
	"net/http"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
	"github.com/Terna27/Aidora/apps/backend/internal/auth"
	"github.com/Terna27/Aidora/apps/backend/internal/emergency"
	"github.com/go-chi/chi/v5"
)

// NewRouter constructs the application HTTP router.
//
// Both dependencies are required. We must not register a protected
// emergency endpoint without a real authentication implementation.
func NewRouter(
	authenticator auth.Authenticator,
	emergencyHandler *emergency.Handler,
) (http.Handler, error) {
	if authenticator == nil {
		return nil, errors.New("authenticator is required")
	}

	if emergencyHandler == nil {
		return nil, errors.New("emergency handler is required")
	}

	router := chi.NewRouter()

	router.Get("/health", healthHandler)

	// All requests to this endpoint must pass authentication.
	router.With(auth.Middleware(authenticator)).
		Post("/api/v1/emergencies", emergencyHandler.Create)

	return router, nil
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]string{
		"status": "ok",
	}

	if err := api.WriteSuccess(w, http.StatusOK, data); err != nil {
		log.Printf("failed to write health response: %v", err)
	}
}
