package location

import "time"

// LocationType identifies whose GPS position is being recorded.
type LocationType string

const (
	LocationTypePatient   LocationType = "PATIENT"
	LocationTypeResponder LocationType = "RESPONDER"
)

// LocationUpdate represents a GPS update received from a mobile device.
type LocationUpdate struct {
	Latitude       float64    `json:"latitude"`
	Longitude      float64    `json:"longitude"`
	AccuracyMeters *float64   `json:"accuracyMeters,omitempty"`
	RecordedAt     *time.Time `json:"recordedAt,omitempty"`
}

// Location represents a persisted emergency location update.
type Location struct {
	ID             string       `json:"id"`
	EmergencyID    string       `json:"emergencyId"`
	Type           LocationType `json:"type"`
	Latitude       float64      `json:"latitude"`
	Longitude      float64      `json:"longitude"`
	AccuracyMeters *float64     `json:"accuracyMeters,omitempty"`
	RecordedAt     *time.Time   `json:"recordedAt,omitempty"`
	ReceivedAt     time.Time    `json:"receivedAt"`
}

// LocationSnapshot contains the latest available positions for an emergency.
type LocationSnapshot struct {
	EmergencyID string    `json:"emergencyId"`
	Patient     *Location `json:"patient,omitempty"`
	Responder   *Location `json:"responder,omitempty"`
}
