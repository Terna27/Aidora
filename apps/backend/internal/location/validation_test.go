package location

import (
	"math"
	"testing"
	"time"
)

func TestValidateLocationUpdate(t *testing.T) {
	tests := []struct {
		name    string
		update  LocationUpdate
		wantErr bool
	}{
		{
			name: "valid coordinates",
			update: LocationUpdate{
				Latitude:  7.123456,
				Longitude: 8.123456,
			},
		},
		{
			name: "valid boundary coordinates",
			update: LocationUpdate{
				Latitude:  90,
				Longitude: -180,
			},
		},
		{
			name: "latitude below minimum",
			update: LocationUpdate{
				Latitude:  -90.0001,
				Longitude: 8,
			},
			wantErr: true,
		},
		{
			name: "latitude above maximum",
			update: LocationUpdate{
				Latitude:  90.0001,
				Longitude: 8,
			},
			wantErr: true,
		},
		{
			name: "longitude below minimum",
			update: LocationUpdate{
				Latitude:  7,
				Longitude: -180.0001,
			},
			wantErr: true,
		},
		{
			name: "longitude above maximum",
			update: LocationUpdate{
				Latitude:  7,
				Longitude: 180.0001,
			},
			wantErr: true,
		},
		{
			name: "NaN latitude",
			update: LocationUpdate{
				Latitude:  math.NaN(),
				Longitude: 8,
			},
			wantErr: true,
		},
		{
			name: "infinite longitude",
			update: LocationUpdate{
				Latitude:  7,
				Longitude: math.Inf(1),
			},
			wantErr: true,
		},
		{
			name: "negative accuracy",
			update: LocationUpdate{
				Latitude:       7,
				Longitude:      8,
				AccuracyMeters: floatPointer(-1),
			},
			wantErr: true,
		},
		{
			name: "NaN accuracy",
			update: LocationUpdate{
				Latitude:       7,
				Longitude:      8,
				AccuracyMeters: floatPointer(math.NaN()),
			},
			wantErr: true,
		},
		{
			name: "infinite accuracy",
			update: LocationUpdate{
				Latitude:       7,
				Longitude:      8,
				AccuracyMeters: floatPointer(math.Inf(1)),
			},
			wantErr: true,
		},
		{
			name: "zero accuracy",
			update: LocationUpdate{
				Latitude:       7,
				Longitude:      8,
				AccuracyMeters: floatPointer(0),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateLocationUpdate(tt.update)

			if tt.wantErr && err == nil {
				t.Fatal("expected an error, got nil")
			}

			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}

func TestValidateLocationType(t *testing.T) {
	if err := ValidateLocationType(LocationTypePatient); err != nil {
		t.Fatalf("patient type should be valid: %v", err)
	}

	if err := ValidateLocationType(LocationTypeResponder); err != nil {
		t.Fatalf("responder type should be valid: %v", err)
	}

	if err := ValidateLocationType("ADMIN"); err == nil {
		t.Fatal("expected unsupported location type to fail")
	}
}

func TestValidateRecordedAtFutureSkew(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name      string
		recorded  *time.Time
		wantError bool
	}{
		{name: "missing device timestamp"},
		{
			name:     "timestamp within allowed skew",
			recorded: timePointer(now.Add(4 * time.Minute)),
		},
		{
			name:      "timestamp beyond allowed skew",
			recorded:  timePointer(now.Add(6 * time.Minute)),
			wantError: true,
		},
		{
			name:     "timestamp in the past",
			recorded: timePointer(now.Add(-24 * time.Hour)),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRecordedAtFutureSkew(tt.recorded, now)

			if tt.wantError && err == nil {
				t.Fatal("expected an error, got nil")
			}

			if !tt.wantError && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}

func floatPointer(value float64) *float64 {
	return &value
}

func timePointer(value time.Time) *time.Time {
	return &value
}
