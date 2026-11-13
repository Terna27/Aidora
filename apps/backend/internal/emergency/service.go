package emergency

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var ErrInvalidLocation = errors.New("invalid pickup location")

type CreateRequest struct {
	Source           LocationSource `json:"source"`
	Latitude         *float64       `json:"latitude"`
	Longitude        *float64       `json:"longitude"`
	AccuracyMeters   *float64       `json:"accuracyMeters"`
	AccuracyLevel    *string        `json:"accuracyLevel"`
	VillageCommunity *string        `json:"villageCommunity"`
	Landmark         *string        `json:"landmark"`
	StreetAddress    *string        `json:"streetAddress"`
	DirectionsNotes  *string        `json:"directionsNotes"`
	Notes            *string        `json:"notes"`
}

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{repository: repository}
}

func (service *Service) Create(
	ctx context.Context,
	patientID string,
	idempotencyKey string,
	request CreateRequest,
) (CreateResult, error) {
	if strings.TrimSpace(patientID) == "" {
		return CreateResult{}, errors.New("patient identity is required")
	}

	idempotencyKey = strings.TrimSpace(idempotencyKey)

	if idempotencyKey == "" {
		return CreateResult{}, errors.New("idempotency key is required")
	}

	emergency := Emergency{
		PatientID:        patientID,
		State:            StateCreated,
		LocationSource:   request.Source,
		Latitude:         request.Latitude,
		Longitude:        request.Longitude,
		AccuracyMeters:   request.AccuracyMeters,
		AccuracyLevel:    normalizeString(request.AccuracyLevel),
		VillageCommunity: normalizeString(request.VillageCommunity),
		Landmark:         normalizeString(request.Landmark),
		StreetAddress:    normalizeString(request.StreetAddress),
		DirectionsNotes:  normalizeString(request.DirectionsNotes),
		PatientNotes:     normalizeString(request.Notes),
	}

	if err := emergency.ValidateLocation(); err != nil {
		return CreateResult{}, fmt.Errorf("%w: %v", ErrInvalidLocation, err)
	}

	// Hash the normalized request, not the raw JSON supplied by the client.
	normalizedRequest := CreateRequest{
		Source:           emergency.LocationSource,
		Latitude:         emergency.Latitude,
		Longitude:        emergency.Longitude,
		AccuracyMeters:   emergency.AccuracyMeters,
		AccuracyLevel:    emergency.AccuracyLevel,
		VillageCommunity: emergency.VillageCommunity,
		Landmark:         emergency.Landmark,
		StreetAddress:    emergency.StreetAddress,
		DirectionsNotes:  emergency.DirectionsNotes,
		Notes:            emergency.PatientNotes,
	}

	payload, err := json.Marshal(normalizedRequest)
	if err != nil {
		return CreateResult{}, fmt.Errorf("marshal normalized request: %w", err)
	}

	hash := sha256.Sum256(payload)

	return service.repository.Create(
		ctx,
		patientID,
		idempotencyKey,
		hash[:],
		emergency,
	)
}

func normalizeString(value *string) *string {
	if value == nil {
		return nil
	}

	normalized := strings.TrimSpace(*value)

	if normalized == "" {
		return nil
	}

	return &normalized
}
