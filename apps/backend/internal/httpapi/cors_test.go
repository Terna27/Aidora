package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSMiddlewarePreflight(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("preflight should not reach the next handler")
	})

	handler := CORSMiddleware(
		[]string{"http://localhost:3000"},
	)(next)

	req := httptest.NewRequest(
		http.MethodOptions,
		"/api/v1/auth/login",
		nil,
	)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "content-type")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("unexpected allowed origin: %q", got)
	}

	if rec.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Fatal("missing allowed methods")
	}

	if rec.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Fatal("missing allowed headers")
	}
}

func TestCORSMiddlewareRejectsUnknownOrigin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("disallowed origin should not reach the next handler")
	})

	handler := CORSMiddleware(
		[]string{"http://localhost:3000"},
	)(next)

	req := httptest.NewRequest(
		http.MethodOptions,
		"/api/v1/auth/login",
		nil,
	)
	req.Header.Set("Origin", "https://unknown.example")
	req.Header.Set("Access-Control-Request-Method", "POST")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}

	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("disallowed origin must not receive CORS permission")
	}
}

func TestCORSMiddlewarePassesNormalRequests(t *testing.T) {
	called := false

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusAccepted)
	})

	handler := CORSMiddleware(
		[]string{"http://localhost:3000"},
	)(next)

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/auth/login",
		nil,
	)
	req.Header.Set("Origin", "http://localhost:3000")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("normal request did not reach the handler")
	}

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
}

func TestCORSMiddlewareRejectsUnsupportedMethod(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("invalid preflight reached handler")
	})

	handler := CORSMiddleware(
		[]string{"http://localhost:3000"},
	)(next)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "DELETE")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestCORSMiddlewareRejectsUnsupportedHeader(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("invalid preflight reached handler")
	})

	handler := CORSMiddleware(
		[]string{"http://localhost:3000"},
	)(next)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "X-Unknown-Header")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}
