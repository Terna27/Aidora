package auth

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newAuthIntegrationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatalf("parse database URL: %v", err)
	}

	// Protect against accidentally running destructive tests
	// against a development or production database.
	if !strings.Contains(
		strings.ToLower(config.ConnConfig.Database),
		"test",
	) {
		t.Fatalf(
			"refusing to run integration tests against database %q: database name must contain 'test'",
			config.ConnConfig.Database,
		)
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatalf("create database pool: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Fatalf("ping test database: %v", err)
	}

	t.Cleanup(pool.Close)

	return pool
}

func createAuthTestUser(
	t *testing.T,
	repo *Repository,
	role string,
) User {
	t.Helper()

	passwordHash, err := HashPassword("IntegrationPassword123!")
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}

	unique := time.Now().UnixNano()

	input := CreateUserInput{
		FullName:     "Integration Test User",
		Email:        fmt.Sprintf("auth-%d@example.test", unique),
		PhoneNumber:  fmt.Sprintf("+1555%d", unique),
		PasswordHash: passwordHash,
		Role:         role,
	}

	ctx := context.Background()

	user, err := repo.CreateUser(ctx, input)
	if err != nil {
		t.Fatalf("create integration test user: %v", err)
	}

	t.Cleanup(func() {
		_, err := repo.pool.Exec(
			context.Background(),
			`DELETE FROM users WHERE id = $1`,
			user.ID,
		)
		if err != nil {
			t.Errorf("clean up integration test user: %v", err)
		}
	})

	return user
}

func containsRole(roles []string, expected string) bool {
	for _, role := range roles {
		if role == expected {
			return true
		}
	}
	return false
}

func TestRepositoryCreateAndGetUser(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	user := createAuthTestUser(t, repo, "patient")

	if user.ID == "" {
		t.Fatal("expected generated user ID")
	}

	if user.FullName != "Integration Test User" {
		t.Errorf("unexpected full name: %q", user.FullName)
	}

	if user.Email == "" {
		t.Error("expected email")
	}

	if user.PhoneNumber == "" {
		t.Error("expected phone number")
	}

	if !containsRole(user.Roles, "patient") {
		t.Errorf("expected patient role, got %v", user.Roles)
	}

	// Retrieve by ID.
	foundByID, err := repo.GetUserByID(
		context.Background(),
		user.ID,
	)
	if err != nil {
		t.Fatalf("get user by ID: %v", err)
	}

	if foundByID.ID != user.ID {
		t.Errorf("expected ID %s, got %s", user.ID, foundByID.ID)
	}

	// Retrieve by email.
	foundByEmail, err := repo.GetUserByEmail(
		context.Background(),
		user.Email,
	)
	if err != nil {
		t.Fatalf("get user by email: %v", err)
	}

	if foundByEmail.ID != user.ID {
		t.Errorf(
			"expected user ID %s, got %s",
			user.ID,
			foundByEmail.ID,
		)
	}

	// Verify the persisted password hash.
	if foundByEmail.PasswordHash != user.PasswordHash {
		t.Fatal("persisted password hash does not match")
	}

	valid, err := VerifyPassword(
		"IntegrationPassword123!",
		foundByEmail.PasswordHash,
	)
	if err != nil {
		t.Fatalf("verify persisted password: %v", err)
	}

	if !valid {
		t.Error("expected persisted password to verify")
	}
}

func TestRepositoryRejectsDuplicateEmail(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	existing := createAuthTestUser(t, repo, "patient")

	passwordHash, err := HashPassword("AnotherPassword123!")
	if err != nil {
		t.Fatal(err)
	}

	_, err = repo.CreateUser(context.Background(), CreateUserInput{
		FullName:     "Another User",
		Email:        existing.Email,
		PhoneNumber:  fmt.Sprintf("+1666%d", time.Now().UnixNano()),
		PasswordHash: passwordHash,
		Role:         "responder",
	})

	if !errors.Is(err, ErrEmailAlreadyExists) {
		t.Fatalf(
			"expected ErrEmailAlreadyExists, got %v",
			err,
		)
	}
}

func TestRepositoryRejectsDuplicatePhoneNumber(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	existing := createAuthTestUser(t, repo, "patient")

	passwordHash, err := HashPassword("AnotherPassword123!")
	if err != nil {
		t.Fatal(err)
	}

	_, err = repo.CreateUser(context.Background(), CreateUserInput{
		FullName:     "Another User",
		Email:        fmt.Sprintf("another-%d@example.test", time.Now().UnixNano()),
		PhoneNumber:  existing.PhoneNumber,
		PasswordHash: passwordHash,
		Role:         "responder",
	})

	if !errors.Is(err, ErrPhoneAlreadyExists) {
		t.Fatalf(
			"expected ErrPhoneAlreadyExists, got %v",
			err,
		)
	}
}

func TestRepositorySupportsMultipleRoles(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	user := createAuthTestUser(t, repo, "patient")

	err := repo.AddRole(
		context.Background(),
		user.ID,
		"responder",
	)
	if err != nil {
		t.Fatalf("add responder role: %v", err)
	}

	// Adding the same role again must fail.
	err = repo.AddRole(
		context.Background(),
		user.ID,
		"responder",
	)

	if !errors.Is(err, ErrRoleAlreadyAssigned) {
		t.Fatalf(
			"expected ErrRoleAlreadyAssigned, got %v",
			err,
		)
	}

	// Retrieve the user and verify both roles exist.
	found, err := repo.GetUserByID(
		context.Background(),
		user.ID,
	)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}

	if !containsRole(found.Roles, "patient") {
		t.Errorf("patient role missing: %v", found.Roles)
	}

	if !containsRole(found.Roles, "responder") {
		t.Errorf("responder role missing: %v", found.Roles)
	}
}

func TestRepositoryReturnsUserNotFound(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	_, err := repo.GetUserByID(
		context.Background(),
		"00000000-0000-0000-0000-000000000000",
	)

	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}

	_, err = repo.GetUserByEmail(
		context.Background(),
		"missing-user@example.test",
	)

	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}

func TestRepositoryRejectsInvalidRole(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	passwordHash, err := HashPassword("IntegrationPassword123!")
	if err != nil {
		t.Fatal(err)
	}

	_, err = repo.CreateUser(context.Background(), CreateUserInput{
		FullName:     "Invalid Role User",
		Email:        fmt.Sprintf("invalid-%d@example.test", time.Now().UnixNano()),
		PhoneNumber:  fmt.Sprintf("+1777%d", time.Now().UnixNano()),
		PasswordHash: passwordHash,
		Role:         "superuser",
	})

	if !errors.Is(err, ErrInvalidRole) {
		t.Fatalf("expected ErrInvalidRole, got %v", err)
	}
}

func TestRepositoryCreateUserRollsBackWhenRoleAssignmentFails(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	ctx := context.Background()

	// Generate unique PostgreSQL object names and a unique test email.
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	functionName := "auth_test_fail_role_" + suffix
	triggerName := "auth_test_fail_role_trigger_" + suffix
	email := fmt.Sprintf("rollback-%s@example.test", suffix)

	// Reject role assignment only for this test's user.
	_, err := pool.Exec(ctx, fmt.Sprintf(`
		CREATE FUNCTION %s()
		RETURNS trigger
		LANGUAGE plpgsql
		AS $body$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM users
				WHERE id = NEW.user_id
				  AND email = '%s'
			) THEN
				RAISE EXCEPTION 'forced role assignment failure';
			END IF;

			RETURN NEW;
		END;
		$body$;
	`, functionName, email))
	if err != nil {
		t.Fatalf("create test trigger function: %v", err)
	}

	// Ensure test database objects are removed even if an assertion fails.
	t.Cleanup(func() {
		_, err := pool.Exec(context.Background(), fmt.Sprintf(
			`DROP TRIGGER IF EXISTS %s ON user_roles`,
			triggerName,
		))
		if err != nil {
			t.Errorf("drop test trigger: %v", err)
		}

		_, err = pool.Exec(context.Background(), fmt.Sprintf(
			`DROP FUNCTION IF EXISTS %s()`,
			functionName,
		))
		if err != nil {
			t.Errorf("drop test trigger function: %v", err)
		}
	})

	_, err = pool.Exec(ctx, fmt.Sprintf(`
		CREATE TRIGGER %s
		BEFORE INSERT ON user_roles
		FOR EACH ROW
		EXECUTE FUNCTION %s()
	`, triggerName, functionName))
	if err != nil {
		t.Fatalf("create test trigger: %v", err)
	}

	passwordHash, err := HashPassword("IntegrationPassword123!")
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}

	_, err = repo.CreateUser(ctx, CreateUserInput{
		FullName:     "Rollback Test User",
		Email:        email,
		PhoneNumber:  "+1888" + suffix,
		PasswordHash: passwordHash,
		Role:         "patient",
	})

	if err == nil {
		t.Fatal("expected CreateUser to fail when role assignment is rejected")
	}

	// The user insert must have been rolled back with the failed role insert.
	_, err = repo.GetUserByEmail(ctx, email)

	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf(
			"expected user to be absent after transaction rollback; got error: %v",
			err,
		)
	}
}

func TestRepositoryConcurrentRoleAssignment(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	user := createAuthTestUser(t, repo, "patient")

	const attempts = 2

	start := make(chan struct{})
	results := make(chan error, attempts)

	var wg sync.WaitGroup

	for i := 0; i < attempts; i++ {
		wg.Add(1)

		go func() {
			defer wg.Done()

			<-start

			err := repo.AddRole(
				context.Background(),
				user.ID,
				"responder",
			)

			results <- err
		}()
	}

	// Release both goroutines simultaneously.
	close(start)

	wg.Wait()
	close(results)

	var successful int
	var alreadyAssigned int

	for err := range results {
		switch {
		case err == nil:
			successful++

		case errors.Is(err, ErrRoleAlreadyAssigned):
			alreadyAssigned++

		default:
			t.Fatalf("unexpected role assignment error: %v", err)
		}
	}

	if successful != 1 {
		t.Errorf("expected exactly 1 successful assignment, got %d", successful)
	}

	if alreadyAssigned != 1 {
		t.Errorf(
			"expected exactly 1 duplicate-role error, got %d",
			alreadyAssigned,
		)
	}

	// Confirm that only one responder role exists.
	found, err := repo.GetUserByID(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("retrieve user: %v", err)
	}

	responderCount := 0
	for _, role := range found.Roles {
		if role == "responder" {
			responderCount++
		}
	}

	if responderCount != 1 {
		t.Errorf(
			"expected exactly 1 responder role, got %d",
			responderCount,
		)
	}
}

func TestRepositoryRejectsInvalidUserID(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	testCases := []struct {
		name string
		id   string
	}{
		{name: "empty ID", id: ""},
		{name: "malformed ID", id: "not-a-uuid"},
		{name: "whitespace ID", id: "   "},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := repo.GetUserByID(
				context.Background(),
				tc.id,
			)

			if !errors.Is(err, ErrInvalidUserID) {
				t.Fatalf(
					"expected ErrInvalidUserID, got %v",
					err,
				)
			}
		})
	}
}

func TestRepositoryAddRoleReturnsUserNotFound(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	nonexistentID := "00000000-0000-0000-0000-000000000099"

	err := repo.AddRole(
		context.Background(),
		nonexistentID,
		"responder",
	)

	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf(
			"expected ErrUserNotFound, got %v",
			err,
		)
	}
}

func TestRepositoryAddRoleReturnsUnexpectedDatabaseError(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	user := createAuthTestUser(t, repo, "patient")

	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	functionName := "auth_test_unexpected_error_" + suffix
	triggerName := "auth_test_unexpected_error_trigger_" + suffix

	_, err := pool.Exec(ctx, fmt.Sprintf(`
		CREATE FUNCTION %s()
		RETURNS trigger
		LANGUAGE plpgsql
		AS $body$
		BEGIN
			RAISE EXCEPTION 'forced unexpected database error';
		END;
		$body$;
	`, functionName))
	if err != nil {
		t.Fatalf("create test function: %v", err)
	}

	t.Cleanup(func() {
		_, err := pool.Exec(context.Background(), fmt.Sprintf(
			`DROP TRIGGER IF EXISTS %s ON user_roles`,
			triggerName,
		))
		if err != nil {
			t.Errorf("drop test trigger: %v", err)
		}

		_, err = pool.Exec(context.Background(), fmt.Sprintf(
			`DROP FUNCTION IF EXISTS %s()`,
			functionName,
		))
		if err != nil {
			t.Errorf("drop test function: %v", err)
		}
	})

	_, err = pool.Exec(ctx, fmt.Sprintf(`
		CREATE TRIGGER %s
		BEFORE INSERT ON user_roles
		FOR EACH ROW
		EXECUTE FUNCTION %s()
	`, triggerName, functionName))
	if err != nil {
		t.Fatalf("create test trigger: %v", err)
	}

	err = repo.AddRole(ctx, user.ID, "responder")

	if err == nil {
		t.Fatal("expected unexpected database error")
	}

	if errors.Is(err, ErrUserNotFound) {
		t.Fatal("unexpected database error was incorrectly mapped to ErrUserNotFound")
	}

	if errors.Is(err, ErrRoleAlreadyAssigned) {
		t.Fatal("unexpected database error was incorrectly mapped to ErrRoleAlreadyAssigned")
	}

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		t.Fatalf("expected wrapped PostgreSQL error, got %T: %v", err, err)
	}

	if pgErr.Code != "P0001" {
		t.Errorf("expected PostgreSQL error code P0001, got %q", pgErr.Code)
	}
}

func createAuthTestUserWithIdentifiers(
	t *testing.T,
	repo *Repository,
	email string,
	phoneNumber string,
) User {
	t.Helper()

	passwordHash, err := HashPassword("IntegrationPassword123!")
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}

	user, err := repo.CreateUser(context.Background(), CreateUserInput{
		FullName:     "Optional Identifier Test User",
		Email:        email,
		PhoneNumber:  phoneNumber,
		PasswordHash: passwordHash,
		Role:         "patient",
	})
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}

	t.Cleanup(func() {
		_, err := repo.pool.Exec(
			context.Background(),
			`DELETE FROM users WHERE id = $1`,
			user.ID,
		)
		if err != nil {
			t.Errorf("clean up test user: %v", err)
		}
	})

	return user
}

func TestRepositoryCreateUserWithEmailOnly(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	email := fmt.Sprintf(
		"email-only-%d@example.test",
		time.Now().UnixNano(),
	)

	user := createAuthTestUserWithIdentifiers(
		t,
		repo,
		email,
		"",
	)

	if user.Email != email {
		t.Errorf("expected email %q, got %q", email, user.Email)
	}

	if user.PhoneNumber != "" {
		t.Errorf("expected empty phone number, got %q", user.PhoneNumber)
	}

	// Verify that PostgreSQL stored NULL, not an empty string.
	var phoneIsNull bool

	err := pool.QueryRow(
		context.Background(),
		`SELECT phone_number IS NULL FROM users WHERE id = $1`,
		user.ID,
	).Scan(&phoneIsNull)

	if err != nil {
		t.Fatalf("check phone number NULL value: %v", err)
	}

	if !phoneIsNull {
		t.Error("expected phone_number to be NULL in database")
	}

	// Verify email lookup.
	found, err := repo.GetUserByEmail(context.Background(), email)
	if err != nil {
		t.Fatalf("get user by email: %v", err)
	}

	if found.ID != user.ID {
		t.Errorf("expected user ID %q, got %q", user.ID, found.ID)
	}
}

func TestRepositoryCreateUserWithPhoneOnly(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	phoneNumber := fmt.Sprintf(
		"+1999%d",
		time.Now().UnixNano(),
	)

	user := createAuthTestUserWithIdentifiers(
		t,
		repo,
		"",
		phoneNumber,
	)

	if user.PhoneNumber != phoneNumber {
		t.Errorf(
			"expected phone number %q, got %q",
			phoneNumber,
			user.PhoneNumber,
		)
	}

	if user.Email != "" {
		t.Errorf("expected empty email, got %q", user.Email)
	}

	// Verify that PostgreSQL stored NULL, not an empty string.
	var emailIsNull bool

	err := pool.QueryRow(
		context.Background(),
		`SELECT email IS NULL FROM users WHERE id = $1`,
		user.ID,
	).Scan(&emailIsNull)

	if err != nil {
		t.Fatalf("check email NULL value: %v", err)
	}

	if !emailIsNull {
		t.Error("expected email to be NULL in database")
	}

	// Verify phone number lookup.
	found, err := repo.GetUserByPhoneNumber(
		context.Background(),
		phoneNumber,
	)
	if err != nil {
		t.Fatalf("get user by phone number: %v", err)
	}

	if found.ID != user.ID {
		t.Errorf("expected user ID %q, got %q", user.ID, found.ID)
	}
}

func TestRepositoryCreateUserRejectsMissingBothIdentifiers(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	passwordHash, err := HashPassword("IntegrationPassword123!")
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}

	_, err = repo.CreateUser(context.Background(), CreateUserInput{
		FullName:     "Missing Identifier User",
		Email:        "",
		PhoneNumber:  "",
		PasswordHash: passwordHash,
		Role:         "patient",
	})

	if err == nil {
		t.Fatal("expected error when both email and phone number are missing")
	}

	if err.Error() != "email or phone number is required" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestRepositoryGetUserByEmailIsCaseInsensitive(t *testing.T) {
	pool := newAuthIntegrationPool(t)
	repo := NewRepository(pool)

	email := fmt.Sprintf(
		"case-test-%d@example.test",
		time.Now().UnixNano(),
	)

	user := createAuthTestUserWithIdentifiers(
		t,
		repo,
		email,
		"",
	)

	// Search using uppercase characters.
	found, err := repo.GetUserByEmail(
		context.Background(),
		strings.ToUpper(email),
	)
	if err != nil {
		t.Fatalf("get user using uppercase email: %v", err)
	}

	if found.ID != user.ID {
		t.Errorf(
			"expected user ID %q, got %q",
			user.ID,
			found.ID,
		)
	}
}
