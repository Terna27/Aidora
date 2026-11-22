// package main

// import (
// 	"context"
// 	"errors"
// 	"fmt"
// 	"log"
// 	"net/http"
// 	"os"
// 	"os/signal"
// 	"syscall"
// 	"time"

// 	"github.com/Terna27/Aidora/apps/backend/internal/auth"
// 	"github.com/Terna27/Aidora/apps/backend/internal/config"
// 	"github.com/Terna27/Aidora/apps/backend/internal/database"
// 	"github.com/Terna27/Aidora/apps/backend/internal/emergency"
// 	"github.com/Terna27/Aidora/apps/backend/internal/httpapi"
// 	"github.com/Terna27/Aidora/apps/backend/internal/location"
// 	"github.com/Terna27/Aidora/apps/backend/internal/notification"
// 	"github.com/Terna27/Aidora/apps/backend/internal/responder"
// )

// func main() {
// 	if err := run(); err != nil {
// 		log.Fatal(err)
// 	}
// }

// func run() error {
// 	// 1. Load and validate application configuration.
// 	jwtConfig, err := config.LoadJWTConfig()
// 	if err != nil {
// 		return fmt.Errorf("load application configuration: %w", err)
// 	}

// 	// Load authentication challenge security configuration.
// 	challengeConfig, err := config.LoadAuthChallengeConfig()
// 	if err != nil {
// 		return fmt.Errorf("load authentication challenge configuration: %w", err)
// 	}

// 	deliveryConfig, err := config.LoadAuthDeliveryConfig()
// 	if err != nil {
// 		return fmt.Errorf("load authentication delivery configuration: %w", err)
// 	}

// 	// 2. Create the JWT access-token verifier.
// 	authenticator, err := auth.NewTokenVerifier(
// 		jwtConfig.PublicKey,
// 		jwtConfig.Issuer,
// 		jwtConfig.Audience,
// 	)
// 	if err != nil {
// 		return fmt.Errorf("create JWT verifier: %w", err)
// 	}

// 	// 3. Establish and verify the PostgreSQL connection.
// 	pool, err := database.NewPostgresPool(context.Background())
// 	if err != nil {
// 		return fmt.Errorf("connect to PostgreSQL: %w", err)
// 	}
// 	defer pool.Close()

// 	log.Println("PostgreSQL connection established successfully")

// 	// 4. Construct the authentication dependency chain.
// 	authRepository := auth.NewRepository(pool)

// 	tokenSigner, err := auth.NewTokenSigner(
// 		jwtConfig.PrivateKey,
// 		jwtConfig.Issuer,
// 		jwtConfig.Audience,
// 	)
// 	if err != nil {
// 		return fmt.Errorf("create JWT token signer: %w", err)
// 	}

// 	authService, err := auth.NewService(
// 		authRepository,
// 		tokenSigner,
// 		jwtConfig.RefreshTokenLifetime,
// 	)
// 	if err != nil {
// 		return fmt.Errorf("create authentication service: %w", err)
// 	}

// 	// Configure verification security.
// 	// A delivery provider must be connected before verification requests can succeed.
// 	verificationSender := notification.NewSender(deliveryConfig)

// 	if err := authService.ConfigureVerification(
// 		challengeConfig.Pepper,
// 		verificationSender,
// 	); err != nil {
// 		return fmt.Errorf("configure authentication verification: %w", err)
// 	}

// 	authHandler := auth.NewHandler(authService)

// 	// 5. Construct the emergency dependency chain.
// 	emergencyRepository := emergency.NewRepository(pool)
// 	emergencyService := emergency.NewService(emergencyRepository)
// 	emergencyHandler := emergency.NewHandler(emergencyService)

// 	// Construct of loocation dependency chain
// 	locationRepository := location.NewRepository(pool)
// 	locationService := location.NewService(locationRepository)
// 	locationHandler := location.NewHandler(locationService)
// 	responderRepository := responder.NewRepository(pool)
// 	responderService := responder.NewService(responderRepository)
// 	responderHandler := responder.NewHandler(responderService)

// 	// 6. Construct the application router.
// 	router, err := httpapi.NewRouter(
// 		authenticator,
// 		authHandler,
// 		emergencyHandler,
// 		locationHandler,
// 		responderHandler,
// 	)
// 	if err != nil {
// 		return fmt.Errorf("create HTTP router: %w", err)
// 	}

// 	// 7. Configure the HTTP server.
// 	port := os.Getenv("PORT")
// 	if port == "" {
// 		port = "8080"
// 	}

// 	server := &http.Server{
// 		Addr:              ":" + port,
// 		Handler:           router,
// 		ReadHeaderTimeout: 5 * time.Second,
// 	}

// 	// 8. Listen for shutdown signals.
// 	shutdownCtx, stop := signal.NotifyContext(
// 		context.Background(),
// 		os.Interrupt,
// 		syscall.SIGTERM,
// 	)
// 	defer stop()

// 	serverErrors := make(chan error, 1)

// 	go func() {
// 		log.Printf("AIDORA API server starting on :%s", port)
// 		serverErrors <- server.ListenAndServe()
// 	}()

// 	// 9. Wait for a server error or shutdown signal.
// 	select {
// 	case err := <-serverErrors:
// 		if !errors.Is(err, http.ErrServerClosed) {
// 			return fmt.Errorf("server failed: %w", err)
// 		}

// 	case <-shutdownCtx.Done():
// 		log.Println("Shutdown signal received")
// 	}

// 	// 10. Allow active requests to finish.
// 	shutdownTimeout, cancel := context.WithTimeout(
// 		context.Background(),
// 		10*time.Second,
// 	)
// 	defer cancel()

// 	if err := server.Shutdown(shutdownTimeout); err != nil {
// 		log.Printf("Graceful shutdown failed: %v", err)

// 		if closeErr := server.Close(); closeErr != nil {
// 			log.Printf("Forced server close failed: %v", closeErr)
// 		}
// 	}

// 	log.Println("HTTP server stopped")

// 	return nil
// }

package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
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

	// Load authentication delivery mode.
	deliveryEnabledValue := strings.TrimSpace(os.Getenv("AUTH_DELIVERY_ENABLED"))

	var deliveryEnabled bool

	switch deliveryEnabledValue {
	case "true":
		deliveryEnabled = true
	case "false":
		deliveryEnabled = false
	default:
		return fmt.Errorf(
			"AUTH_DELIVERY_ENABLED must be explicitly set to true or false",
		)
	}

	// Disabling delivery is permitted only in staging.
	if !deliveryEnabled && strings.TrimSpace(os.Getenv("APP_ENV")) != "staging" {
		return fmt.Errorf(
			"AUTH_DELIVERY_ENABLED=false is only permitted when APP_ENV=staging",
		)
	}

	// Create the verification sender only when delivery is enabled.
	var verificationSender auth.VerificationCodeSender

	if deliveryEnabled {
		deliveryConfig, err := config.LoadAuthDeliveryConfig()
		if err != nil {
			return fmt.Errorf(
				"load authentication delivery configuration: %w",
				err,
			)
		}

		verificationSender = notification.NewSender(deliveryConfig)
		log.Println("Authentication email/SMS delivery enabled")
	} else {
		log.Println("Authentication email/SMS delivery disabled for staging")
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
	// The sender is nil when delivery is disabled in staging.
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

	// Construct the location dependency chain.
	locationRepository := location.NewRepository(pool)
	locationService := location.NewService(locationRepository)
	locationHandler := location.NewHandler(locationService)

	// Construct the responder dependency chain.
	responderRepository := responder.NewRepository(pool)
	responderService := responder.NewService(responderRepository)
	responderHandler := responder.NewHandler(responderService)

	corsConfig, err := config.LoadCORSConfig()
	if err != nil {
		return fmt.Errorf("load CORS configuration: %w", err)
	}

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
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           httpapi.CORSMiddleware(corsConfig.AllowedOrigins)(router),
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
		log.Printf("AIDORA API server starting on :%s", port)
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
