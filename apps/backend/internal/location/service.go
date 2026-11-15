package location

import "context"

type RepositoryInterface interface {
    SavePatientLocation(
        ctx context.Context,
        emergencyID string,
        patientID string,
        update LocationUpdate,
    ) (Location, error)

    SaveResponderLocation(
        ctx context.Context,
        emergencyID string,
        responderID string,
        update LocationUpdate,
    ) (Location, error)

    LatestForEmergencyForUser(
        ctx context.Context,
        emergencyID string,
        requesterID string,
    ) (LocationSnapshot, error)
}

type Service struct {
    repository RepositoryInterface
}

func NewService(repository RepositoryInterface) *Service {
    return &Service{
        repository: repository,
    }
}

func (s *Service) SavePatientLocation(
    ctx context.Context,
    emergencyID string,
    patientID string,
    update LocationUpdate,
) (Location, error) {
    return s.repository.SavePatientLocation(
        ctx,
        emergencyID,
        patientID,
        update,
    )
}

func (s *Service) SaveResponderLocation(
    ctx context.Context,
    emergencyID string,
    responderID string,
    update LocationUpdate,
) (Location, error) {
    return s.repository.SaveResponderLocation(
        ctx,
        emergencyID,
        responderID,
        update,
    )
}

func (s *Service) GetSnapshot(
    ctx context.Context,
    emergencyID string,
    requesterID string,
) (LocationSnapshot, error) {
    return s.repository.LatestForEmergencyForUser(
        ctx,
        emergencyID,
        requesterID,
    )
}
