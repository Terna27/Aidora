package responder

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"
)

const maxServiceDescriptionLength = 2000

var ErrInvalidServiceDescription = errors.New("invalid service description")

type ApplicationRepository interface {
	Apply(
		ctx context.Context,
		userID string,
		typeCodes []string,
		description *string,
	) (ApplicationResult, error)
}

type Service struct {
	repository ApplicationRepository
}

func NewService(repository ApplicationRepository) *Service {
	return &Service{repository: repository}
}

type ApplicationRequest struct {
	ResponderTypes     []string `json:"responderTypes"`
	ServiceDescription string   `json:"serviceDescription,omitempty"`
}

func (service *Service) Apply(
	ctx context.Context,
	userID string,
	request ApplicationRequest,
) (ApplicationResult, error) {
	if strings.TrimSpace(userID) == "" || len(request.ResponderTypes) == 0 {
		return ApplicationResult{}, ErrInvalidApplication
	}

	// Normalize and validate the selected responder types.
	typeCodes := make([]string, 0, len(request.ResponderTypes))
	seen := make(map[string]struct{}, len(request.ResponderTypes))

	for _, rawCode := range request.ResponderTypes {
		code := strings.ToLower(strings.TrimSpace(rawCode))
		if code == "" {
			return ApplicationResult{}, ErrInvalidApplication
		}

		if _, exists := seen[code]; exists {
			return ApplicationResult{}, ErrInvalidApplication
		}

		seen[code] = struct{}{}
		typeCodes = append(typeCodes, code)
	}

	descriptionText := strings.TrimSpace(request.ServiceDescription)

	if utf8.RuneCountInString(descriptionText) > maxServiceDescriptionLength {
		return ApplicationResult{}, ErrInvalidServiceDescription
	}

	var description *string
	if descriptionText != "" {
		description = &descriptionText
	}

	return service.repository.Apply(ctx, userID, typeCodes, description)
}
