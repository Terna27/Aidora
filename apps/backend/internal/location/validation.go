package location

import (
	"errors"
	"math"
	"time"
)

var ErrInvalidLocation = errors.New("invalid location")

// ValidateLocationUpdate validates coordinates and optional GPS metadata.
func ValidateLocationUpdate(update LocationUpdate) error {
	if math.IsNaN(update.Latitude) ||
		math.IsInf(update.Latitude, 0) ||
		update.Latitude < -90 ||
		update.Latitude > 90 {
		return ErrInvalidLocation
	}

	if math.IsNaN(update.Longitude) ||
		math.IsInf(update.Longitude, 0) ||
		update.Longitude < -180 ||
		update.Longitude > 180 {
		return ErrInvalidLocation
	}

	if update.AccuracyMeters != nil {
		accuracy := *update.AccuracyMeters

		if math.IsNaN(accuracy) ||
			math.IsInf(accuracy, 0) ||
			accuracy < 0 {
			return ErrInvalidLocation
		}
	}

	if update.RecordedAt != nil && update.RecordedAt.IsZero() {
		return ErrInvalidLocation
	}

	return nil
}

// ValidateLocationType verifies that a location type is supported.
func ValidateLocationType(locationType LocationType) error {
	switch locationType {
	case LocationTypePatient, LocationTypeResponder:
		return nil
	default:
		return ErrInvalidLocation
	}
}

// ValidateRecordedAtFutureSkew rejects device timestamps too far in the future.
// The server receipt timestamp remains authoritative for ordering.
func ValidateRecordedAtFutureSkew(recordedAt *time.Time, now time.Time) error {
	if recordedAt == nil {
		return nil
	}

	if recordedAt.After(now.Add(5 * time.Minute)) {
		return ErrInvalidLocation
	}

	return nil
}
