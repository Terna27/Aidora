package location

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// newLocationIntegrationPool connects only to an explicitly named test database.
func newLocationIntegrationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping PostgreSQL integration test")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatalf("parse TEST_DATABASE_URL: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
	}

	t.Cleanup(pool.Close)

	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("ping test database: %v", err)
	}

	var databaseName string
	if err := pool.QueryRow(ctx, "SELECT current_database()").Scan(&databaseName); err != nil {
		t.Fatalf("identify connected database: %v", err)
	}

	if !strings.Contains(strings.ToLower(databaseName), "test") {
		t.Fatalf(
			"refusing to run integration tests against database %q: database name must contain 'test'",
			databaseName,
		)
	}

	return pool
}

// createLocationTestUser creates a user, role, and corresponding profile.
// Its cleanup removes dependent tracking records before deleting the user.
func createLocationTestUser(t *testing.T, pool *pgxpool.Pool, role string) string {
	t.Helper()

	ctx := context.Background()
	unique := fmt.Sprintf("%d", time.Now().UnixNano())

	var userID string

	err := pool.QueryRow(ctx, `
		INSERT INTO users (
			full_name,
			email,
			phone_number,
			password_hash
		)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text
	`,
		"Location Integration Test "+role,
		role+"-"+unique+"@example.test",
		"+234"+unique,
		"integration-test-password-hash",
	).Scan(&userID)
	if err != nil {
		t.Fatalf("create %s test user: %v", role, err)
	}

	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// Remove locations referencing this user's emergencies or assignments.
		_, err := pool.Exec(cleanupCtx, `
			DELETE FROM emergency_locations
			WHERE emergency_id IN (
				SELECT id FROM emergencies WHERE patient_id = $1
			)
			OR responder_assignment_id IN (
				SELECT id
				FROM emergency_responder_assignments
				WHERE responder_id = $1
			)
		`, userID)
		if err != nil {
			t.Errorf("clean up locations for user %s: %v", userID, err)
		}

		// Remove assignments before deleting their emergencies or responder.
		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM emergency_responder_assignments
			WHERE emergency_id IN (
				SELECT id FROM emergencies WHERE patient_id = $1
			)
			OR responder_id = $1
		`, userID)
		if err != nil {
			t.Errorf("clean up responder assignments for user %s: %v", userID, err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM emergency_state_history
			WHERE emergency_id IN (
				SELECT id FROM emergencies WHERE patient_id = $1
			)
		`, userID)
		if err != nil {
			t.Errorf("clean up emergency history for user %s: %v", userID, err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM emergencies WHERE patient_id = $1
		`, userID)
		if err != nil {
			t.Errorf("clean up emergencies for user %s: %v", userID, err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM patient_profiles WHERE user_id = $1
		`, userID)
		if err != nil {
			t.Errorf("clean up patient profile for user %s: %v", userID, err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM responder_profiles WHERE user_id = $1
		`, userID)
		if err != nil {
			t.Errorf("clean up responder profile for user %s: %v", userID, err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM user_roles WHERE user_id = $1
		`, userID)
		if err != nil {
			t.Errorf("clean up user roles for user %s: %v", userID, err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM users WHERE id = $1
		`, userID)
		if err != nil {
			t.Errorf("clean up user %s: %v", userID, err)
		}
	})

	_, err = pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		VALUES ($1, $2)
	`, userID, role)
	if err != nil {
		t.Fatalf("assign %s role: %v", role, err)
	}

	switch role {
	case "patient":
		_, err = pool.Exec(ctx, `
			INSERT INTO patient_profiles (user_id)
			VALUES ($1)
		`, userID)

	case "responder":
		_, err = pool.Exec(ctx, `
			INSERT INTO responder_profiles (user_id)
			VALUES ($1)
		`, userID)

	default:
		t.Fatalf("unsupported test role %q", role)
	}

	if err != nil {
		t.Fatalf("create %s profile: %v", role, err)
	}

	return userID
}

// createLocationTestEmergency inserts a GPS emergency with known pickup coordinates.
func createLocationTestEmergency(
	t *testing.T,
	pool *pgxpool.Pool,
	patientID string,
	latitude float64,
	longitude float64,
) string {
	t.Helper()

	var emergencyID string

	err := pool.QueryRow(context.Background(), `
		INSERT INTO emergencies (
			patient_id,
			current_state,
			location_source,
			location,
			latitude,
			longitude,
			accuracy_meters
		)
		VALUES (
			$1,
			'DISPATCHING',
			'GPS',
			ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
			$2,
			$3,
			10
		)
		RETURNING id::text
	`,
		patientID,
		latitude,
		longitude,
	).Scan(&emergencyID)

	if err != nil {
		t.Fatalf("create location test emergency: %v", err)
	}

	return emergencyID
}

// createLocationTestAssignment creates an active responder assignment.
func createLocationTestAssignment(
	t *testing.T,
	pool *pgxpool.Pool,
	emergencyID string,
	responderID string,
) string {
	t.Helper()

	var assignmentID string

	err := pool.QueryRow(context.Background(), `
		INSERT INTO emergency_responder_assignments (
			emergency_id,
			responder_id
		)
		VALUES ($1, $2)
		RETURNING id::text
	`,
		emergencyID,
		responderID,
	).Scan(&assignmentID)

	if err != nil {
		t.Fatalf("create responder assignment: %v", err)
	}

	return assignmentID
}

func TestPostgresSavePatientLocation(t *testing.T) {
	pool := newLocationIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	patientID := createLocationTestUser(t, pool, "patient")
	emergencyID := createLocationTestEmergency(
		t, pool, patientID, 6.5244, 3.3792,
	)

	accuracy := 8.5
	recordedAt := time.Now().UTC()

	saved, err := repo.SavePatientLocation(
		ctx,
		emergencyID,
		patientID,
		LocationUpdate{
			Latitude:       6.5300,
			Longitude:      3.3800,
			AccuracyMeters: &accuracy,
			RecordedAt:     &recordedAt,
		},
	)
	if err != nil {
		t.Fatalf("save patient location: %v", err)
	}

	if saved.EmergencyID != emergencyID {
		t.Errorf("expected emergency ID %s, got %s", emergencyID, saved.EmergencyID)
	}

	if saved.Type != LocationTypePatient {
		t.Errorf("expected location type PATIENT, got %s", saved.Type)
	}

	if saved.Latitude != 6.5300 || saved.Longitude != 3.3800 {
		t.Errorf(
			"unexpected saved coordinates: latitude=%f longitude=%f",
			saved.Latitude,
			saved.Longitude,
		)
	}

	var (
		storedEmergencyID string
		storedPatientID   string
		storedType        string
		pointLongitude    float64
		pointLatitude     float64
	)

	err = pool.QueryRow(ctx, `
		SELECT
			emergency_id::text,
			patient_id::text,
			location_type,
			ST_X(location::geometry),
			ST_Y(location::geometry)
		FROM emergency_locations
		WHERE id = $1
	`, saved.ID).Scan(
		&storedEmergencyID,
		&storedPatientID,
		&storedType,
		&pointLongitude,
		&pointLatitude,
	)
	if err != nil {
		t.Fatalf("read persisted patient location: %v", err)
	}

	if storedEmergencyID != emergencyID {
		t.Errorf("stored emergency ID: expected %s, got %s", emergencyID, storedEmergencyID)
	}

	if storedPatientID != patientID {
		t.Errorf("stored patient ID: expected %s, got %s", patientID, storedPatientID)
	}

	if storedType != string(LocationTypePatient) {
		t.Errorf("expected stored type PATIENT, got %s", storedType)
	}

	if pointLongitude != 3.3800 || pointLatitude != 6.5300 {
		t.Errorf(
			"incorrect PostGIS point: longitude=%f latitude=%f",
			pointLongitude,
			pointLatitude,
		)
	}
}

func TestPostgresPatientCannotUpdateAnotherPatientsEmergency(t *testing.T) {
	pool := newLocationIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	ownerID := createLocationTestUser(t, pool, "patient")
	otherPatientID := createLocationTestUser(t, pool, "patient")

	emergencyID := createLocationTestEmergency(
		t, pool, ownerID, 6.5244, 3.3792,
	)

	_, err := repo.SavePatientLocation(
		ctx,
		emergencyID,
		otherPatientID,
		LocationUpdate{
			Latitude:  6.5300,
			Longitude: 3.3800,
		},
	)

	if !errors.Is(err, ErrLocationAccessDenied) {
		t.Fatalf("expected ErrLocationAccessDenied, got %v", err)
	}

	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM emergency_locations
		WHERE emergency_id = $1
	`, emergencyID).Scan(&count)
	if err != nil {
		t.Fatalf("count emergency locations: %v", err)
	}

	if count != 0 {
		t.Errorf("unauthorized update must not create a location; found %d", count)
	}
}

func TestPostgresResponderLocationRequiresActiveAssignment(t *testing.T) {
	pool := newLocationIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	patientID := createLocationTestUser(t, pool, "patient")
	responderID := createLocationTestUser(t, pool, "responder")

	emergencyID := createLocationTestEmergency(
		t, pool, patientID, 6.5244, 3.3792,
	)

	// The responder has a valid profile but no assignment to this emergency.
	_, err := repo.SaveResponderLocation(
		ctx,
		emergencyID,
		responderID,
		LocationUpdate{
			Latitude:  6.5400,
			Longitude: 3.3900,
		},
	)

	if !errors.Is(err, ErrLocationAccessDenied) {
		t.Fatalf("expected ErrLocationAccessDenied without an active assignment, got %v", err)
	}

	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM emergency_locations
		WHERE emergency_id = $1
		  AND location_type = 'RESPONDER'
	`, emergencyID).Scan(&count)
	if err != nil {
		t.Fatalf("count responder locations: %v", err)
	}

	if count != 0 {
		t.Errorf("unassigned responder must not create a location; found %d", count)
	}
}

func TestPostgresLatestLocationsForEmergency(t *testing.T) {
	pool := newLocationIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	patientID := createLocationTestUser(t, pool, "patient")
	responderID := createLocationTestUser(t, pool, "responder")

	emergencyID := createLocationTestEmergency(
		t, pool, patientID, 6.5244, 3.3792,
	)

	createLocationTestAssignment(t, pool, emergencyID, responderID)

	// Save two patient positions. The second device timestamp is older,
	// but its server receipt time is later and must determine the latest position.
	firstPatientTime := time.Now().UTC()
	secondPatientTime := firstPatientTime.Add(-time.Hour)

	_, err := repo.SavePatientLocation(
		ctx,
		emergencyID,
		patientID,
		LocationUpdate{
			Latitude:   6.5300,
			Longitude:  3.3800,
			RecordedAt: &firstPatientTime,
		},
	)
	if err != nil {
		t.Fatalf("save first patient location: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	_, err = repo.SavePatientLocation(
		ctx,
		emergencyID,
		patientID,
		LocationUpdate{
			Latitude:   6.5350,
			Longitude:  3.3850,
			RecordedAt: &secondPatientTime,
		},
	)
	if err != nil {
		t.Fatalf("save second patient location: %v", err)
	}

	// Save two responder positions.
	_, err = repo.SaveResponderLocation(
		ctx,
		emergencyID,
		responderID,
		LocationUpdate{
			Latitude:  6.5400,
			Longitude: 3.3900,
		},
	)
	if err != nil {
		t.Fatalf("save first responder location: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	_, err = repo.SaveResponderLocation(
		ctx,
		emergencyID,
		responderID,
		LocationUpdate{
			Latitude:  6.5450,
			Longitude: 3.3950,
		},
	)
	if err != nil {
		t.Fatalf("save second responder location: %v", err)
	}

	snapshot, err := repo.LatestForEmergency(ctx, emergencyID)
	if err != nil {
		t.Fatalf("retrieve latest emergency locations: %v", err)
	}

	if snapshot.EmergencyID != emergencyID {
		t.Errorf("expected emergency ID %s, got %s", emergencyID, snapshot.EmergencyID)
	}

	if snapshot.Patient == nil {
		t.Fatal("expected latest patient location")
	}

	if snapshot.Patient.Latitude != 6.5350 ||
		snapshot.Patient.Longitude != 3.3850 {
		t.Errorf(
			"unexpected latest patient location: latitude=%f longitude=%f",
			snapshot.Patient.Latitude,
			snapshot.Patient.Longitude,
		)
	}

	if snapshot.Patient.Type != LocationTypePatient {
		t.Errorf("expected patient location type PATIENT, got %s", snapshot.Patient.Type)
	}

	if snapshot.Responder == nil {
		t.Fatal("expected latest responder location")
	}

	if snapshot.Responder.Latitude != 6.5450 ||
		snapshot.Responder.Longitude != 3.3950 {
		t.Errorf(
			"unexpected latest responder location: latitude=%f longitude=%f",
			snapshot.Responder.Latitude,
			snapshot.Responder.Longitude,
		)
	}

	if snapshot.Responder.Type != LocationTypeResponder {
		t.Errorf("expected responder location type RESPONDER, got %s", snapshot.Responder.Type)
	}
}

func TestPostgresLocationHistoryIsPreserved(t *testing.T) {
	pool := newLocationIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	patientID := createLocationTestUser(t, pool, "patient")
	emergencyID := createLocationTestEmergency(
		t, pool, patientID, 6.5244, 3.3792,
	)

	updates := []LocationUpdate{
		{
			Latitude:  6.5300,
			Longitude: 3.3800,
		},
		{
			Latitude:  6.5350,
			Longitude: 3.3850,
		},
	}

	for i, update := range updates {
		_, err := repo.SavePatientLocation(ctx, emergencyID, patientID, update)
		if err != nil {
			t.Fatalf("save patient location update %d: %v", i+1, err)
		}
	}

	var (
		count       int
		firstCount  int
		secondCount int
	)

	err := pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (
				WHERE latitude = 6.5300 AND longitude = 3.3800
			),
			COUNT(*) FILTER (
				WHERE latitude = 6.5350 AND longitude = 3.3850
			)
		FROM emergency_locations
		WHERE emergency_id = $1
		  AND location_type = 'PATIENT'
	`, emergencyID).Scan(&count, &firstCount, &secondCount)
	if err != nil {
		t.Fatalf("read patient location history: %v", err)
	}

	if count != 2 {
		t.Errorf("expected 2 preserved location records, got %d", count)
	}

	if firstCount != 1 {
		t.Errorf("expected first location to remain in history once, got %d", firstCount)
	}

	if secondCount != 1 {
		t.Errorf("expected second location to remain in history once, got %d", secondCount)
	}
}

func TestPostgresLiveLocationDoesNotChangeEmergencyPickup(t *testing.T) {
	pool := newLocationIntegrationPool(t)
	repo := NewRepository(pool)
	ctx := context.Background()

	patientID := createLocationTestUser(t, pool, "patient")

	const (
		pickupLatitude  = 6.5244
		pickupLongitude = 3.3792
	)

	emergencyID := createLocationTestEmergency(
		t,
		pool,
		patientID,
		pickupLatitude,
		pickupLongitude,
	)

	_, err := repo.SavePatientLocation(
		ctx,
		emergencyID,
		patientID,
		LocationUpdate{
			Latitude:  6.6000,
			Longitude: 3.4500,
		},
	)
	if err != nil {
		t.Fatalf("save live patient location: %v", err)
	}

	var (
		storedLatitude  float64
		storedLongitude float64
		pointLatitude   float64
		pointLongitude  float64
	)

	err = pool.QueryRow(ctx, `
		SELECT
			latitude,
			longitude,
			ST_Y(location::geometry),
			ST_X(location::geometry)
		FROM emergencies
		WHERE id = $1
	`, emergencyID).Scan(
		&storedLatitude,
		&storedLongitude,
		&pointLatitude,
		&pointLongitude,
	)
	if err != nil {
		t.Fatalf("read original emergency pickup: %v", err)
	}

	if storedLatitude != pickupLatitude ||
		storedLongitude != pickupLongitude {
		t.Errorf(
			"live location changed pickup coordinates: latitude=%f longitude=%f",
			storedLatitude,
			storedLongitude,
		)
	}

	if pointLatitude != pickupLatitude ||
		pointLongitude != pickupLongitude {
		t.Errorf(
			"live location changed pickup PostGIS point: latitude=%f longitude=%f",
			pointLatitude,
			pointLongitude,
		)
	}
}
