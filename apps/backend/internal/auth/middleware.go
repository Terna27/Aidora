package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

type Authenticator interface {
	Authenticate(ctx context.Context, accessToken string) (Principal, error)
}

func Middleware(authenticator Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			parts := strings.Fields(r.Header.Get("Authorization"))

			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				writeUnauthenticated(w)
				return
			}

			principal, err := authenticator.Authenticate(r.Context(), parts[1])

			if err != nil {
				writeUnauthenticated(w)
				return
			}

			principal.UserID = strings.TrimSpace(principal.UserID)

			if principal.UserID == "" {
				writeUnauthenticated(w)
				return
			}

			ctx := WithPrincipal(r.Context(), principal)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func writeUnauthenticated(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)

	response := struct {
		Success bool `json:"success"`
		Error   struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}{
		Success: false,
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{
			Code:    "UNAUTHENTICATED",
			Message: "Authentication is missing or invalid",
		},
	}

	_ = json.NewEncoder(w).Encode(response)
}
