package emergency

import "time"

type LocationSource string

const (
	LocationSourceGPS    LocationSource = "GPS"
	LocationSourceManual LocationSource = "MANUAL"
)

type Emergency struct {
	ID        string
	PatientID string
	State     State

	LocationSource LocationSource

	Latitude       *float64
	Longitude      *float64
	AccuracyMeters *float64
	AccuracyLevel  *string

	VillageCommunity *string
	Landmark         *string
	StreetAddress    *string
	DirectionsNotes  *string
	PatientNotes     *string

	CancelledAt        *time.Time
	CancelledBy        *string
	CancellationReason *string

	DismissedAt *time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}
