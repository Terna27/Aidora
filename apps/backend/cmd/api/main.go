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

	"github.com/Terna27/Aidora/apps/backend/internal/auth"
	"github.com/Terna27/Aidora/apps/backend/internal/config"
	"github.com/Terna27/Aidora/apps/backend/internal/database"
	"github.com/Terna27/Aidora/apps/backend/internal/emergency"
	"github.com/Terna27/Aidora/apps/backend/internal/httpapi"
	"github.com/Terna27/Aidora/apps/backend/internal/location"
	"github.com/Terna27/Aidora/apps/backend/internal/notification"
	"github.com/Terna27/Aidora/apps/backend/internal/responder"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	// 1. Load and validate application configuration.
	jwtConfig, err := config.LoadJWTConfig()
	if err != nil {
		return fmt.Errorf("load application configuration: %w", err)
	}

	// Load authentication challenge security configuration.
	challengeConfig, err := config.LoadAuthChallengeConfig()
	if err != nil {
		return fmt.Errorf("load authentication challenge configuration: %w", err)
	}

	deliveryConfig, err := config.LoadAuthDeliveryConfig()
	if err != nil {
		return fmt.Errorf("load authentication delivery configuration: %w", err)
	}

	// 2. Create the JWT access-token verifier.
	authenticator, err := auth.NewTokenVerifier(
		jwtConfig.PublicKey,
		jwtConfig.Issuer,
		jwtConfig.Audience,
	)
	if err != nil {
		return fmt.Errorf("create JWT verifier: %w", err)
	}

	// 3. Establish and verify the PostgreSQL connection.
	pool, err := database.NewPostgresPool(context.Background())
	if err != nil {
		return fmt.Errorf("connect to PostgreSQL: %w", err)
	}
	defer pool.Close()

	log.Println("PostgreSQL connection established successfully")

	// 4. Construct the authentication dependency chain.
	authRepository := auth.NewRepository(pool)

	tokenSigner, err := auth.NewTokenSigner(
		jwtConfig.PrivateKey,
		jwtConfig.Issuer,
		jwtConfig.Audience,
	)
	if err != nil {
		return fmt.Errorf("create JWT token signer: %w", err)
	}

	authService, err := auth.NewService(
		authRepository,
		tokenSigner,
		jwtConfig.RefreshTokenLifetime,
	)
	if err != nil {
		return fmt.Errorf("create authentication service: %w", err)
	}

	// Configure verification security.
	// A delivery provider must be connected before verification requests can succeed.
	verificationSender := notification.NewSender(deliveryConfig)

	if err := authService.ConfigureVerification(
		challengeConfig.Pepper,
		verificationSender,
	); err != nil {
		return fmt.Errorf("configure authentication verification: %w", err)
	}

	authHandler := auth.NewHandler(authService)

	// 5. Construct the emergency dependency chain.
	emergencyRepository := emergency.NewRepository(pool)
	emergencyService := emergency.NewService(emergencyRepository)
	emergencyHandler := emergency.NewHandler(emergencyService)

	// Construct of loocation dependency chain
	locationRepository := location.NewRepository(pool)
	locationService := location.NewService(locationRepository)
	locationHandler := location.NewHandler(locationService)
	responderRepository := responder.NewRepository(pool)
	responderService := responder.NewService(responderRepository)
	responderHandler := responder.NewHandler(responderService)

	// 6. Construct the application router.
	router, err := httpapi.NewRouter(
		authenticator,
		authHandler,
		emergencyHandler,
		locationHandler,
		responderHandler,
	)
	if err != nil {
		return fmt.Errorf("create HTTP router: %w", err)
	}

	// 7. Configure the HTTP server.
	server := &http.Server{
		Addr:              ":8080",
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// 8. Listen for shutdown signals.
	shutdownCtx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	serverErrors := make(chan error, 1)

	go func() {
		log.Println("AIDORA API server starting on :8080")
		serverErrors <- server.ListenAndServe()
	}()

	// 9. Wait for a server error or shutdown signal.
	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("server failed: %w", err)
		}

	case <-shutdownCtx.Done():
		log.Println("Shutdown signal received")
	}

	// 10. Allow active requests to finish.
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
