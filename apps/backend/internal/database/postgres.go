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
	var connectionURL string

	// Prefer DATABASE_URL for hosted environments such as Neon.
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		connectionURL = databaseURL
	} else {
		// Keep individual variables for local development.
		host := os.Getenv("POSTGRES_HOST")
		port := os.Getenv("POSTGRES_PORT")
		dbName := os.Getenv("POSTGRES_DB")
		user := os.Getenv("POSTGRES_USER")
		password := os.Getenv("POSTGRES_PASSWORD")

		if host == "" {
			host = "127.0.0.1"
		}
		if port == "" {
			port = "5432"
		}

		if dbName == "" || user == "" || password == "" {
			return nil, fmt.Errorf("database configuration is incomplete")
		}

		u := url.URL{
			Scheme: "postgres",
			User:   url.UserPassword(user, password),
			Host:   net.JoinHostPort(host, port),
			Path:   dbName,
		}

		query := url.Values{}
		query.Set("sslmode", "disable")
		u.RawQuery = query.Encode()

		connectionURL = u.String()
	}

	config, err := pgxpool.ParseConfig(connectionURL)
	if err != nil {
		return nil, fmt.Errorf("parse database configuration: %w", err)
	}

	config.MaxConns = 10

	connectCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, config)
	if err != nil {
		return nil, fmt.Errorf("create database connection pool: %w", err)
	}

	if err := pool.Ping(connectCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	return pool, nil
}
