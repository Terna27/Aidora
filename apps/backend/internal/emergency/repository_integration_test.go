package emergency

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newIntegrationPool(t *testing.T) *pgxpool.Pool {
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

	// Refuse to run destructive cleanup against a database without
	// an explicitly test-related name.
	if !strings.Contains(strings.ToLower(databaseName), "test") {
		t.Fatalf(
			"refusing to run integration tests against database %q: database name must contain 'test'",
			databaseName,
		)
	}

	return pool
}

func createTestPatient(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()

	ctx := context.Background()

	unique := fmt.Sprintf("%d", time.Now().UnixNano())

	var patientID string

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
		"Integration Test Patient",
		"patient-"+unique+"@example.test",
		"+234"+unique,
		"integration-test-password-hash",
	).Scan(&patientID)

	if err != nil {
		t.Fatalf("create test patient: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		VALUES ($1, 'patient')
	`, patientID)

	if err != nil {
		t.Fatalf("assign patient role: %v", err)
	}

	// Remove dependent records before deleting the test user.
	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
		defer cancel()

		_, err := pool.Exec(cleanupCtx, `
			DELETE FROM emergency_idempotency_keys
			WHERE patient_id = $1
		`, patientID)
		if err != nil {
			t.Errorf("clean up idempotency records: %v", err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM emergency_state_history
			WHERE emergency_id IN (
				SELECT id FROM emergencies WHERE patient_id = $1
			)
		`, patientID)
		if err != nil {
			t.Errorf("clean up emergency history: %v", err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM emergencies
			WHERE patient_id = $1
		`, patientID)
		if err != nil {
			t.Errorf("clean up emergencies: %v", err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM user_roles WHERE user_id = $1
		`, patientID)
		if err != nil {
			t.Errorf("clean up user roles: %v", err)
		}

		_, err = pool.Exec(cleanupCtx, `
			DELETE FROM users WHERE id = $1
		`, patientID)
		if err != nil {
			t.Errorf("clean up test user: %v", err)
		}
	})

	return patientID
}

func floatPointer(value float64) *float64 {
	return &value
}

func stringPointer(value string) *string {
	return &value
}

func TestPostgresCreateGPSEmergency(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)

	service := NewService(NewRepository(pool))

	request := CreateRequest{
		Source:         LocationSourceGPS,
		Latitude:       floatPointer(6.5244),
		Longitude:      floatPointer(3.3792),
		AccuracyMeters: floatPointer(12.5),
	}

	result, err := service.Create(
		context.Background(),
		patientID,
		"gps-create-test",
		request,
	)
	if err != nil {
		t.Fatalf("create GPS emergency: %v", err)
	}

	if result.Status != 202 {
		t.Fatalf("expected HTTP status 202, got %d", result.Status)
	}

	if result.Replayed {
		t.Fatal("first creation must not be marked as replayed")
	}

	var response struct {
		ID             string         `json:"id"`
		State          State          `json:"state"`
		LocationSource LocationSource `json:"locationSource"`
		CreatedAt      time.Time      `json:"createdAt"`
	}

	if err := json.Unmarshal(result.Data, &response); err != nil {
		t.Fatalf("decode creation response: %v", err)
	}

	if response.ID == "" {
		t.Fatal("expected emergency ID in response")
	}

	if response.State != StateDispatching {
		t.Fatalf("expected state %q, got %q", StateDispatching, response.State)
	}

	if response.LocationSource != LocationSourceGPS {
		t.Fatalf(
			"expected source %q, got %q",
			LocationSourceGPS,
			response.LocationSource,
		)
	}

	var (
		state          string
		source         string
		latitude       float64
		longitude      float64
		accuracy       float64
		pointLongitude float64
		pointLatitude  float64
	)

	err = pool.QueryRow(context.Background(), `
		SELECT
			current_state,
			location_source,
			latitude,
			longitude,
			accuracy_meters,
			ST_X(location::geometry),
			ST_Y(location::geometry)
		FROM emergencies
		WHERE id = $1
	`, response.ID).Scan(
		&state,
		&source,
		&latitude,
		&longitude,
		&accuracy,
		&pointLongitude,
		&pointLatitude,
	)

	if err != nil {
		t.Fatalf("read created GPS emergency: %v", err)
	}

	if state != string(StateDispatching) {
		t.Errorf("database state: expected DISPATCHING, got %s", state)
	}

	if source != string(LocationSourceGPS) {
		t.Errorf("database source: expected GPS, got %s", source)
	}

	if latitude != 6.5244 || longitude != 3.3792 {
		t.Errorf("unexpected stored coordinates: latitude=%f longitude=%f", latitude, longitude)
	}

	if accuracy != 12.5 {
		t.Errorf("expected accuracy 12.5, got %f", accuracy)
	}

	// PostGIS X is longitude; Y is latitude.
	if pointLongitude != 3.3792 || pointLatitude != 6.5244 {
		t.Errorf(
			"incorrect PostGIS point: longitude=%f latitude=%f",
			pointLongitude,
			pointLatitude,
		)
	}

	assertCreationHistory(t, pool, response.ID)
	assertIdempotencyRecord(t, pool, patientID, "gps-create-test", response.ID)
}

func TestPostgresCreateManualEmergency(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)

	service := NewService(NewRepository(pool))

	request := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Near the central market"),
		DirectionsNotes:  stringPointer("Use the main entrance"),
		Notes:            stringPointer("Patient is waiting outside"),
	}

	result, err := service.Create(
		context.Background(),
		patientID,
		"manual-create-test",
		request,
	)
	if err != nil {
		t.Fatalf("create manual emergency: %v", err)
	}

	var response struct {
		ID             string         `json:"id"`
		State          State          `json:"state"`
		LocationSource LocationSource `json:"locationSource"`
	}

	if err := json.Unmarshal(result.Data, &response); err != nil {
		t.Fatalf("decode creation response: %v", err)
	}

	if response.ID == "" {
		t.Fatal("expected emergency ID in response")
	}

	if response.State != StateDispatching {
		t.Fatalf("expected state %q, got %q", StateDispatching, response.State)
	}

	if response.LocationSource != LocationSourceManual {
		t.Fatalf(
			"expected source %q, got %q",
			LocationSourceManual,
			response.LocationSource,
		)
	}

	var (
		state           string
		source          string
		locationIsNull  bool
		latitudeIsNull  bool
		longitudeIsNull bool
		village         string
		landmark        string
		directions      string
		notes           string
	)

	err = pool.QueryRow(context.Background(), `
		SELECT
			current_state,
			location_source,
			location IS NULL,
			latitude IS NULL,
			longitude IS NULL,
			village_community,
			landmark,
			directions_notes,
			patient_notes
		FROM emergencies
		WHERE id = $1
	`, response.ID).Scan(
		&state,
		&source,
		&locationIsNull,
		&latitudeIsNull,
		&longitudeIsNull,
		&village,
		&landmark,
		&directions,
		&notes,
	)

	if err != nil {
		t.Fatalf("read created manual emergency: %v", err)
	}

	if state != string(StateDispatching) {
		t.Errorf("database state: expected DISPATCHING, got %s", state)
	}

	if source != string(LocationSourceManual) {
		t.Errorf("database source: expected MANUAL, got %s", source)
	}

	if !locationIsNull || !latitudeIsNull || !longitudeIsNull {
		t.Error("manual emergency must not contain GPS location or coordinates")
	}

	if village != "Ikeja" {
		t.Errorf("expected village Ikeja, got %q", village)
	}

	if landmark != "Near the central market" {
		t.Errorf("unexpected landmark: %q", landmark)
	}

	if directions != "Use the main entrance" {
		t.Errorf("unexpected directions: %q", directions)
	}

	if notes != "Patient is waiting outside" {
		t.Errorf("unexpected patient notes: %q", notes)
	}

	assertCreationHistory(t, pool, response.ID)
	assertIdempotencyRecord(t, pool, patientID, "manual-create-test", response.ID)
}

func assertCreationHistory(t *testing.T, pool *pgxpool.Pool, emergencyID string) {
	t.Helper()

	rows, err := pool.Query(context.Background(), `
		SELECT
			COALESCE(previous_state, ''),
			new_state,
			actor_type
		FROM emergency_state_history
		WHERE emergency_id = $1
		ORDER BY occurred_at ASC, id ASC
	`, emergencyID)
	if err != nil {
		t.Fatalf("read emergency history: %v", err)
	}
	defer rows.Close()

	type historyEntry struct {
		previous string
		current  string
		actor    string
	}

	var entries []historyEntry

	for rows.Next() {
		var entry historyEntry

		if err := rows.Scan(
			&entry.previous,
			&entry.current,
			&entry.actor,
		); err != nil {
			t.Fatalf("scan emergency history: %v", err)
		}

		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("iterate emergency history: %v", err)
	}

	if len(entries) != 2 {
		t.Fatalf("expected 2 history entries, got %d", len(entries))
	}

	if entries[0].previous != "" ||
		entries[0].current != "CREATED" ||
		entries[0].actor != "PATIENT" {
		t.Errorf("unexpected initial history entry: %+v", entries[0])
	}

	if entries[1].previous != "CREATED" ||
		entries[1].current != "DISPATCHING" ||
		entries[1].actor != "SYSTEM" {
		t.Errorf("unexpected dispatch history entry: %+v", entries[1])
	}
}

func assertIdempotencyRecord(
	t *testing.T,
	pool *pgxpool.Pool,
	patientID string,
	key string,
	emergencyID string,
) {
	t.Helper()

	var (
		storedEmergencyID string
		status            int
	)

	err := pool.QueryRow(context.Background(), `
		SELECT emergency_id::text, response_status
		FROM emergency_idempotency_keys
		WHERE patient_id = $1
		  AND idempotency_key = $2
	`, patientID, key).Scan(&storedEmergencyID, &status)

	if err != nil {
		t.Fatalf("read idempotency record: %v", err)
	}

	if storedEmergencyID != emergencyID {
		t.Errorf(
			"idempotency record references emergency %s; expected %s",
			storedEmergencyID,
			emergencyID,
		)
	}

	if status != 202 {
		t.Errorf("expected idempotency response status 202, got %d", status)
	}
}

// Ensure the test harness can also identify a missing test database URL
// without accidentally falling back to the application's normal DB config.
var _ = pgx.ErrNoRows

func TestPostgresIdempotentRetry(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)

	service := NewService(NewRepository(pool))

	request := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Central market"),
	}

	first, err := service.Create(
		context.Background(),
		patientID,
		"same-request-key",
		request,
	)
	if err != nil {
		t.Fatalf("first creation: %v", err)
	}

	second, err := service.Create(
		context.Background(),
		patientID,
		"same-request-key",
		request,
	)
	if err != nil {
		t.Fatalf("idempotent retry: %v", err)
	}

	if first.Replayed {
		t.Error("first request must not be a replay")
	}

	if !second.Replayed {
		t.Error("second request must be marked as replayed")
	}

	if first.Status != second.Status {
		t.Errorf("statuses differ: first=%d second=%d", first.Status, second.Status)
	}

	var firstData, secondData any

	if err := json.Unmarshal(first.Data, &firstData); err != nil {
		t.Fatalf("decode first response: %v", err)
	}

	if err := json.Unmarshal(second.Data, &secondData); err != nil {
		t.Fatalf("decode replayed response: %v", err)
	}

	if !reflect.DeepEqual(firstData, secondData) {
		t.Errorf(
			"replayed response differs:\nfirst:  %s\nsecond: %s",
			first.Data,
			second.Data,
		)
	}

	assertPatientCreationCounts(t, pool, patientID, 1, 2, 1)
}

func TestPostgresIdempotencyPayloadConflict(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)

	service := NewService(NewRepository(pool))

	firstRequest := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Central market"),
	}

	_, err := service.Create(
		context.Background(),
		patientID,
		"conflicting-request-key",
		firstRequest,
	)
	if err != nil {
		t.Fatalf("first creation: %v", err)
	}

	differentRequest := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Different landmark"),
	}

	_, err = service.Create(
		context.Background(),
		patientID,
		"conflicting-request-key",
		differentRequest,
	)

	if !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("expected ErrIdempotencyConflict, got %v", err)
	}

	// A conflicting retry must not create another emergency,
	// history entry, or idempotency record.
	assertPatientCreationCounts(t, pool, patientID, 1, 2, 1)
}

func assertPatientCreationCounts(
	t *testing.T,
	pool *pgxpool.Pool,
	patientID string,
	expectedEmergencies int,
	expectedHistory int,
	expectedKeys int,
) {
	t.Helper()

	var emergencies, history, keys int

	err := pool.QueryRow(context.Background(), `
		SELECT
			(SELECT COUNT(*)
			 FROM emergencies
			 WHERE patient_id = $1),

			(SELECT COUNT(*)
			 FROM emergency_state_history h
			 JOIN emergencies e ON e.id = h.emergency_id
			 WHERE e.patient_id = $1),

			(SELECT COUNT(*)
			 FROM emergency_idempotency_keys
			 WHERE patient_id = $1)
	`, patientID).Scan(&emergencies, &history, &keys)

	if err != nil {
		t.Fatalf("count patient creation records: %v", err)
	}

	if emergencies != expectedEmergencies {
		t.Errorf("expected %d emergencies, got %d", expectedEmergencies, emergencies)
	}

	if history != expectedHistory {
		t.Errorf("expected %d history entries, got %d", expectedHistory, history)
	}

	if keys != expectedKeys {
		t.Errorf("expected %d idempotency keys, got %d", expectedKeys, keys)
	}
}

func TestPostgresExpiredIdempotencyKeyReuse(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)
	service := NewService(NewRepository(pool))

	request := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Central market"),
	}

	first, err := service.Create(
		context.Background(),
		patientID,
		"expired-key",
		request,
	)
	if err != nil {
		t.Fatalf("first creation: %v", err)
	}

	var firstResponse struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(first.Data, &firstResponse); err != nil {
		t.Fatalf("decode first response: %v", err)
	}

	// Make the first emergency terminal so another can be created.
	_, err = pool.Exec(context.Background(), `
        UPDATE emergencies
        SET current_state = 'CANCELLED',
            updated_at = clock_timestamp()
        WHERE id = $1
    `, firstResponse.ID)
	if err != nil {
		t.Fatalf("cancel first emergency: %v", err)
	}

	// Record the corresponding state transition.
	_, err = pool.Exec(context.Background(), `
        INSERT INTO emergency_state_history (
            emergency_id,
            previous_state,
            new_state,
            actor_type,
            actor_user_id
        )
        VALUES ($1, 'DISPATCHING', 'CANCELLED', 'PATIENT', $2)
    `, firstResponse.ID, patientID)
	if err != nil {
		t.Fatalf("record cancellation history: %v", err)
	}

	// Simulate expiration without waiting 24 hours.
	_, err = pool.Exec(context.Background(), `
        UPDATE emergency_idempotency_keys
        SET expires_at = clock_timestamp() - interval '1 second'
        WHERE patient_id = $1
          AND idempotency_key = $2
    `, patientID, "expired-key")
	if err != nil {
		t.Fatalf("expire idempotency key: %v", err)
	}

	second, err := service.Create(
		context.Background(),
		patientID,
		"expired-key",
		request,
	)
	if err != nil {
		t.Fatalf("creation after expiration: %v", err)
	}

	if second.Replayed {
		t.Error("expired key must not return a replay")
	}

	var secondResponse struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(second.Data, &secondResponse); err != nil {
		t.Fatalf("decode second response: %v", err)
	}

	if firstResponse.ID == secondResponse.ID {
		t.Error("expired key reuse must create a new emergency")
	}

	// 2 emergencies, 5 history records, 1 current idempotency key.
	assertPatientCreationCounts(t, pool, patientID, 2, 5, 1)
}

func TestPostgresConcurrentIdempotentRequests(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)
	service := NewService(NewRepository(pool))

	request := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Central market"),
	}

	type outcome struct {
		result CreateResult
		err    error
	}

	start := make(chan struct{})
	results := make(chan outcome, 2)

	for i := 0; i < 2; i++ {
		go func() {
			<-start

			result, err := service.Create(
				context.Background(),
				patientID,
				"concurrent-key",
				request,
			)

			results <- outcome{
				result: result,
				err:    err,
			}
		}()
	}

	// Release both requests together.
	close(start)

	first := <-results
	second := <-results

	if first.err != nil {
		t.Fatalf("first concurrent request: %v", first.err)
	}

	if second.err != nil {
		t.Fatalf("second concurrent request: %v", second.err)
	}

	if first.result.Replayed == second.result.Replayed {
		t.Error("exactly one request must be the original creation and the other a replay")
	}

	if first.result.Status != second.result.Status {
		t.Errorf(
			"statuses differ: %d and %d",
			first.result.Status,
			second.result.Status,
		)
	}

	var firstResponse, secondResponse struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(first.result.Data, &firstResponse); err != nil {
		t.Fatalf("decode first response: %v", err)
	}

	if err := json.Unmarshal(second.result.Data, &secondResponse); err != nil {
		t.Fatalf("decode second response: %v", err)
	}

	if firstResponse.ID != secondResponse.ID {
		t.Errorf(
			"concurrent requests created different emergencies: %s and %s",
			firstResponse.ID,
			secondResponse.ID,
		)
	}

	// Exactly one emergency, two history entries, one idempotency record.
	assertPatientCreationCounts(t, pool, patientID, 1, 2, 1)
}

func TestPostgresRejectsSecondActiveEmergency(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)
	service := NewService(NewRepository(pool))

	request := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Central market"),
	}

	_, err := service.Create(
		context.Background(),
		patientID,
		"active-emergency-key-1",
		request,
	)
	if err != nil {
		t.Fatalf("first emergency creation: %v", err)
	}

	_, err = service.Create(
		context.Background(),
		patientID,
		"active-emergency-key-2",
		request,
	)

	if !errors.Is(err, ErrActiveEmergency) {
		t.Fatalf("expected ErrActiveEmergency, got: %v", err)
	}

	// The rejected request must not create any additional records.
	assertPatientCreationCounts(t, pool, patientID, 1, 2, 1)
}

func TestPostgresCreateEmergencyRollsBackOnHistoryFailure(t *testing.T) {
	pool := newIntegrationPool(t)
	patientID := createTestPatient(t, pool)
	service := NewService(NewRepository(pool))

	// Install a temporary test fault that rejects the dispatch history entry.
	_, err := pool.Exec(context.Background(), `
        CREATE OR REPLACE FUNCTION public.test_fail_dispatch_history()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF NEW.new_state = 'DISPATCHING' THEN
                RAISE EXCEPTION 'simulated history insertion failure';
            END IF;

            RETURN NEW;
        END;
        $$;

        CREATE TRIGGER test_fail_dispatch_history_trigger
        BEFORE INSERT ON emergency_state_history
        FOR EACH ROW
        EXECUTE FUNCTION public.test_fail_dispatch_history();
    `)
	if err != nil {
		t.Fatalf("install test failure trigger: %v", err)
	}

	t.Cleanup(func() {
		_, cleanupErr := pool.Exec(context.Background(), `
            DROP TRIGGER IF EXISTS test_fail_dispatch_history_trigger
            ON emergency_state_history;

            DROP FUNCTION IF EXISTS public.test_fail_dispatch_history();
        `)
		if cleanupErr != nil {
			t.Errorf("remove test failure trigger: %v", cleanupErr)
		}
	})

	request := CreateRequest{
		Source:           LocationSourceManual,
		VillageCommunity: stringPointer("Ikeja"),
		Landmark:         stringPointer("Central market"),
	}

	_, err = service.Create(
		context.Background(),
		patientID,
		"rollback-test-key",
		request,
	)

	if err == nil {
		t.Fatal("expected creation to fail when history insertion is rejected")
	}

	// Every write in the failed transaction must have been rolled back.
	assertPatientCreationCounts(t, pool, patientID, 0, 0, 0)
}
