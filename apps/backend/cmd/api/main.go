package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Terna27/Aidora/apps/backend/internal/api"
	"github.com/Terna27/Aidora/apps/backend/internal/database"
	"github.com/go-chi/chi/v5"
)

type APIResponse struct {
	Success bool `json:"success"`
	Data    any  `json:"data,omitempty"`
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	// Establish and verify the PostgreSQL connection.
	pool, err := database.NewPostgresPool(context.Background())
	if err != nil {
		return fmt.Errorf("connect to PostgreSQL: %w", err)
	}
	defer pool.Close()

	log.Println("PostgreSQL connection established successfully")

	// Initialize the HTTP router.
	router := chi.NewRouter()
	router.Get("/health", healthHandler)

	// Configure the HTTP server.
	server := &http.Server{
		Addr:              ":8080",
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Start listening for shutdown signals.
	shutdownCtx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	// Start the HTTP server in a separate goroutine.
	serverErrors := make(chan error, 1)

	go func() {
		log.Println("AIDORA API server starting on :8080")
		serverErrors <- server.ListenAndServe()
	}()

	// Wait for either a server error or a shutdown signal.
	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("server failed: %w", err)
		}

	case <-shutdownCtx.Done():
		log.Println("Shutdown signal received")
	}

	// Allow active HTTP requests to finish.
	shutdownTimeout, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	if err := server.Shutdown(shutdownTimeout); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)

		if closeErr := server.Close(); closeErr != nil {
			log.Printf("Forced server close failed: %v", closeErr)
		}
	}

	log.Println("HTTP server stopped")

	return nil
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]string{
		"status": "ok",
	}

	if err := api.WriteSuccess(w, http.StatusOK, data); err != nil {
		log.Printf("failed to write health response: %v", err)
	}
}
