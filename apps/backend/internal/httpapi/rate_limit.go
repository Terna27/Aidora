package httpapi

import (
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
)

type rateLimitEntry struct {
	windowStart time.Time
	requests    int
}

type ipRateLimiter struct {
	mu            sync.Mutex
	limit         int
	window        time.Duration
	entries       map[string]rateLimitEntry
	lastCleanup   time.Time
	cleanupPeriod time.Duration
}

func newIPRateLimiter(limit int, window time.Duration) *ipRateLimiter {
	if limit < 1 {
		panic("rate limit must be positive")
	}
	if window <= 0 {
		panic("rate limit window must be positive")
	}

	return &ipRateLimiter{
		limit:         limit,
		window:        window,
		entries:       make(map[string]rateLimitEntry),
		lastCleanup:   time.Now(),
		cleanupPeriod: window,
	}
}

func (l *ipRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := clientIPFromRequest(r)
		now := time.Now()

		allowed, retryAfter := l.allow(clientIP, now)
		if !allowed {
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))

			if err := api.WriteError(
				w,
				http.StatusTooManyRequests,
				"RATE_LIMIT_EXCEEDED",
				"Too many requests. Please try again later.",
				nil,
			); err != nil {
				log.Printf("failed to write rate limit response: %v", err)
			}
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (l *ipRateLimiter) allow(clientIP string, now time.Time) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if now.Sub(l.lastCleanup) >= l.cleanupPeriod {
		for ip, entry := range l.entries {
			if now.Sub(entry.windowStart) >= l.window {
				delete(l.entries, ip)
			}
		}
		l.lastCleanup = now
	}

	entry, exists := l.entries[clientIP]
	if !exists || now.Sub(entry.windowStart) >= l.window {
		l.entries[clientIP] = rateLimitEntry{
			windowStart: now,
			requests:    1,
		}
		return true, 0
	}

	if entry.requests >= l.limit {
		remaining := l.window - now.Sub(entry.windowStart)
		retryAfter := int(math.Ceil(remaining.Seconds()))
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter
	}

	entry.requests++
	l.entries[clientIP] = entry

	return true, 0
}

func clientIPFromRequest(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}

	if ip := net.ParseIP(r.RemoteAddr); ip != nil {
		return ip.String()
	}

	// Avoid trusting unvalidated forwarding headers.
	return fmt.Sprintf("unknown:%s", r.RemoteAddr)
}
