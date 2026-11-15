package httpapi

import (
	"errors"
	"log"
	"net/http"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
	"github.com/Terna27/Aidora/apps/backend/internal/auth"
	"github.com/Terna27/Aidora/apps/backend/internal/emergency"
	"github.com/Terna27/Aidora/apps/backend/internal/location"
	"github.com/go-chi/chi/v5"
)

// NewRouter constructs the application HTTP router.
func NewRouter(
	authenticator auth.Authenticator,
	authHandler *auth.Handler,
	emergencyHandler *emergency.Handler,
	locationHandler *location.Handler,
) (http.Handler, error) {
	if authenticator == nil {
		return nil, errors.New("authenticator is required")
	}

	if authHandler == nil {
		return nil, errors.New("authentication handler is required")
	}

	if locationHandler == nil {
		return nil, errors.New("location handler is required")
	}

	if emergencyHandler == nil {
		return nil, errors.New("emergency handler is required")
	}

	router := chi.NewRouter()

	router.Get("/health", healthHandler)

	// Public authentication endpoints.
	// Public authentication endpoints.
	router.Post("/api/v1/auth/register", authHandler.Register)
	router.Post("/api/v1/auth/login", authHandler.Login)
	router.Post("/api/v1/auth/refresh", authHandler.Refresh)

	// Public identity verification endpoints.
	router.Post("/api/v1/auth/verify/email/request", authHandler.RequestEmailVerification)
	router.Post("/api/v1/auth/verify/email/confirm", authHandler.VerifyEmail)
	router.Post("/api/v1/auth/verify/phone/request", authHandler.RequestPhoneVerification)
	router.Post("/api/v1/auth/verify/phone/confirm", authHandler.VerifyPhone)

	// Public password recovery endpoints.
	router.Post("/api/v1/auth/password/forgot", authHandler.RequestPasswordReset)
	router.Post("/api/v1/auth/password/reset", authHandler.ResetPassword)

	// Authentication is required for these endpoints.
	router.Group(func(r chi.Router) {
		r.Use(auth.Middleware(authenticator))

		r.Post("/api/v1/auth/logout", authHandler.Logout)
		r.Get("/api/v1/auth/me", authHandler.Me)

		r.Post("/api/v1/emergencies", emergencyHandler.Create)
		r.Post("/api/v1/emergencies/{id}/locations/patient", locationHandler.SavePatientLocation)
		r.Post("/api/v1/emergencies/{id}/locations/responder", locationHandler.SaveResponderLocation)
		r.Get("/api/v1/emergencies/{id}/locations", locationHandler.GetLocations)
		r.Post("/api/v1/emergencies/{id}/cancel", emergencyHandler.Cancel)
	})

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
