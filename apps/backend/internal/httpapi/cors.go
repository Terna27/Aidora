package httpapi

import (
	"net/http"
	"strings"
)

func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))

	for _, origin := range allowedOrigins {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			allowed[origin] = struct{}{}
		}
	}

	allowedMethods := map[string]bool{
		http.MethodGet:  true,
		http.MethodPost: true,
	}

	allowedHeaders := map[string]bool{
		"content-type":    true,
		"authorization":   true,
		"idempotency-key": true,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Add("Vary", "Origin")

			if _, ok := allowed[origin]; !ok {
				http.Error(w, "Origin not allowed", http.StatusForbidden)
				return
			}

			w.Header().Set("Access-Control-Allow-Origin", origin)

			if r.Method == http.MethodOptions &&
				r.Header.Get("Access-Control-Request-Method") != "" {

				w.Header().Add("Vary", "Access-Control-Request-Method")
				w.Header().Add("Vary", "Access-Control-Request-Headers")

				method := r.Header.Get("Access-Control-Request-Method")
				if !allowedMethods[method] {
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
					return
				}

				for _, header := range strings.Split(
					r.Header.Get("Access-Control-Request-Headers"), ",",
				) {
					header = strings.ToLower(strings.TrimSpace(header))

					if header != "" && !allowedHeaders[header] {
						http.Error(w, "Header not allowed", http.StatusForbidden)
						return
					}
				}

				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				w.Header().Set(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization, Idempotency-Key",
				)
				w.Header().Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
