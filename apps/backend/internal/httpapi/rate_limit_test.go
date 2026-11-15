
package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
)

func TestIPRateLimiter_AllowsRequestsWithinLimit(t *testing.T) {
	limiter := newIPRateLimiter(2, time.Minute)

	handler := limiter.Middleware(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = "192.0.2.1:1234"

		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, rec.Code)
		}
	}
}

func TestIPRateLimiter_RejectsRequestsOverLimit(t *testing.T) {
	limiter := newIPRateLimiter(1, time.Minute)

	handler := limiter.Middleware(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))

	first := httptest.NewRequest(http.MethodPost, "/", nil)
	first.RemoteAddr = "192.0.2.1:1234"

	firstRec := httptest.NewRecorder()
	handler.ServeHTTP(firstRec, first)

	second := httptest.NewRequest(http.MethodPost, "/", nil)
	second.RemoteAddr = "192.0.2.1:1234"

	secondRec := httptest.NewRecorder()
	handler.ServeHTTP(secondRec, second)

	if secondRec.Code != http.StatusTooManyRequests {
		t.Fatalf(
			"expected 429, got %d",
			secondRec.Code,
		)
	}

	if secondRec.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header")
	}

	var response api.Response
	if err := json.Unmarshal(secondRec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if response.Success {
		t.Fatal("expected unsuccessful response")
	}

	if response.Error == nil ||
		response.Error.Code != "RATE_LIMIT_EXCEEDED" {
		t.Fatalf("unexpected error response: %+v", response.Error)
	}
}

func TestIPRateLimiter_SeparatesClientIPs(t *testing.T) {
	limiter := newIPRateLimiter(1, time.Minute)

	handler := limiter.Middleware(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))

	for _, ip := range []string{
		"192.0.2.1:1234",
		"192.0.2.2:1234",
	} {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = ip

		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for %s, got %d", ip, rec.Code)
		}
	}
}

func TestClientIPFromRequest_DoesNotTrustForwardedHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.0.2.1:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.99")

	got := clientIPFromRequest(req)

	if got != "192.0.2.1" {
		t.Fatalf("expected remote IP, got %q", got)
	}
}
