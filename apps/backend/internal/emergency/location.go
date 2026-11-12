package emergency

import (
	"fmt"
	"math"
	"strings"
)

func (e Emergency) ValidateLocation() error {
	switch e.LocationSource {
	case LocationSourceGPS:
		if e.Latitude == nil || e.Longitude == nil {
			return fmt.Errorf("GPS location requires latitude and longitude")
		}

		if math.IsNaN(*e.Latitude) || math.IsInf(*e.Latitude, 0) ||
			*e.Latitude < -90 || *e.Latitude > 90 {
			return fmt.Errorf("latitude must be between -90 and 90")
		}

		if math.IsNaN(*e.Longitude) || math.IsInf(*e.Longitude, 0) ||
			*e.Longitude < -180 || *e.Longitude > 180 {
			return fmt.Errorf("longitude must be between -180 and 180")
		}

		if e.AccuracyMeters != nil {
			if math.IsNaN(*e.AccuracyMeters) ||
				math.IsInf(*e.AccuracyMeters, 0) ||
				*e.AccuracyMeters < 0 {
				return fmt.Errorf("accuracy must be a finite non-negative number")
			}
		}

	case LocationSourceManual:
		if e.Latitude != nil || e.Longitude != nil ||
			e.AccuracyMeters != nil || e.AccuracyLevel != nil {
			return fmt.Errorf("manual location must not contain GPS coordinates or accuracy")
		}

		hasDescription :=
			(e.VillageCommunity != nil && strings.TrimSpace(*e.VillageCommunity) != "") ||
				(e.Landmark != nil && strings.TrimSpace(*e.Landmark) != "") ||
				(e.StreetAddress != nil && strings.TrimSpace(*e.StreetAddress) != "")

		if !hasDescription {
			return fmt.Errorf("manual location requires a village/community, landmark, or street address")
		}

	default:
		return fmt.Errorf("unsupported location source: %q", e.LocationSource)
	}

	return nil
}
