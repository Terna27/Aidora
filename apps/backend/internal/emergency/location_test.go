package emergency

import (
	"math"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestEmergency_ValidateLocation(t *testing.T) {
	tests := []struct {
		name      string
		emergency Emergency
		wantErr   bool
	}{
		{
			name: "GPS with valid coordinates",
			emergency: Emergency{
				LocationSource: LocationSourceGPS,
				Latitude:       ptr(6.5244),
				Longitude:      ptr(3.3792),
				AccuracyMeters: ptr(12.5),
			},
			wantErr: false,
		},
		{
			name: "GPS without latitude",
			emergency: Emergency{
				LocationSource: LocationSourceGPS,
				Longitude:      ptr(3.3792),
			},
			wantErr: true,
		},
		{
			name: "GPS latitude 91",
			emergency: Emergency{
				LocationSource: LocationSourceGPS,
				Latitude:       ptr(91.0),
				Longitude:      ptr(3.3792),
			},
			wantErr: true,
		},
		{
			name: "GPS longitude -181",
			emergency: Emergency{
				LocationSource: LocationSourceGPS,
				Latitude:       ptr(6.5244),
				Longitude:      ptr(-181.0),
			},
			wantErr: true,
		},
		{
			name: "GPS with negative accuracy",
			emergency: Emergency{
				LocationSource: LocationSourceGPS,
				Latitude:       ptr(6.5244),
				Longitude:      ptr(3.3792),
				AccuracyMeters: ptr(-1.0),
			},
			wantErr: true,
		},
		{
			name: "Manual with village/community",
			emergency: Emergency{
				LocationSource:   LocationSourceManual,
				VillageCommunity: ptr("Ikorodu"),
			},
			wantErr: false,
		},
		{
			name: "Manual with landmark",
			emergency: Emergency{
				LocationSource: LocationSourceManual,
				Landmark:       ptr("Near the central market"),
			},
			wantErr: false,
		},
		{
			name: "Manual with street address",
			emergency: Emergency{
				LocationSource: LocationSourceManual,
				StreetAddress:  ptr("12 Allen Avenue"),
			},
			wantErr: false,
		},
		{
			// No village/community, landmark or street address supplied.
			// If your struct has a separate directions field, set it here.
			name: "Manual with only directions",
			emergency: Emergency{
				LocationSource:  LocationSourceManual,
				DirectionsNotes: ptr("Turn left after the bridge"),
			},
			wantErr: true,
		},
		{
			name: "Manual with GPS coordinates",
			emergency: Emergency{
				LocationSource:   LocationSourceManual,
				VillageCommunity: ptr("Ikorodu"),
				Latitude:         ptr(6.5244),
				Longitude:        ptr(3.3792),
			},
			wantErr: true,
		},
		{
			name: "Manual with whitespace-only descriptions",
			emergency: Emergency{
				LocationSource:   LocationSourceManual,
				VillageCommunity: ptr("   "),
				Landmark:         ptr("\t"),
				StreetAddress:    ptr("\n  "),
			},
			wantErr: true,
		},
		{
			name: "Unknown location source",
			emergency: Emergency{
				LocationSource: LocationSource("satellite"),
			},
			wantErr: true,
		},
		{
			name: "GPS with NaN accuracy",
			emergency: Emergency{
				LocationSource: LocationSourceGPS,
				Latitude:       ptr(6.5244),
				Longitude:      ptr(3.3792),
				AccuracyMeters: ptr(math.NaN()),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.emergency.ValidateLocation()
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateLocation() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
