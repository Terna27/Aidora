package database

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgresPool(ctx context.Context) (*pgxpool.Pool, error) {
	// Read database settings from environment variables.
	host := os.Getenv("POSTGRES_HOST")
	port := os.Getenv("POSTGRES_PORT")
	dbName := os.Getenv("POSTGRES_DB")
	user := os.Getenv("POSTGRES_USER")
	password := os.Getenv("POSTGRES_PASSWORD")

	// Apply local development defaults.
	if host == "" {
		host = "127.0.0.1"
	}

	if port == "" {
		port = "5432"
	}

	// Required settings must be present.
	if dbName == "" || user == "" || password == "" {
		return nil, fmt.Errorf("database configuration is incomplete")
	}

	// Build a connection URL safely, including password escaping.
	connectionURL := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(user, password),
		Host:   net.JoinHostPort(host, port),
		Path:   dbName,
	}

	query := url.Values{}
	query.Set("sslmode", "disable")
	connectionURL.RawQuery = query.Encode()

	// Parse the connection configuration.
	config, err := pgxpool.ParseConfig(connectionURL.String())
	if err != nil {
		return nil, fmt.Errorf("parse database configuration: %w", err)
	}

	// Set a reasonable connection pool limit.
	config.MaxConns = 10

	// Attempt to establish and verify the connection.
	connectCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, config)
	if err != nil {
		return nil, fmt.Errorf("create database connection pool: %w", err)
	}

	if err := pool.Ping(connectCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}
