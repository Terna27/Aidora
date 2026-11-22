package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type CORSConfig struct {
	AllowedOrigins []string
}

func LoadCORSConfig() (CORSConfig, error) {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))

	if raw == "" {
		return CORSConfig{}, fmt.Errorf(
			"%w: CORS_ALLOWED_ORIGINS is required",
			ErrInvalidConfig,
		)
	}

	origins := strings.Split(raw, ",")
	allowed := make([]string, 0, len(origins))
	seen := make(map[string]bool)

	for _, entry := range origins {
		origin := strings.TrimSpace(entry)

		parsed, err := url.Parse(origin)
		if err != nil ||
			(parsed.Scheme != "http" && parsed.Scheme != "https") ||
			parsed.Host == "" ||
			parsed.User != nil ||
			parsed.Path != "" ||
			parsed.RawQuery != "" ||
			parsed.Fragment != "" ||
			parsed.Opaque != "" ||
			origin != parsed.Scheme+"://"+parsed.Host {
			return CORSConfig{}, fmt.Errorf(
				"%w: invalid CORS origin %q",
				ErrInvalidConfig,
				origin,
			)
		}

		if !seen[origin] {
			allowed = append(allowed, origin)
			seen[origin] = true
		}
	}

	return CORSConfig{AllowedOrigins: allowed}, nil
}
