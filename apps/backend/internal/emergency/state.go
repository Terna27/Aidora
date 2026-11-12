package emergency

type State string

const (
	StateCreated          State = "CREATED"
	StateDispatching      State = "DISPATCHING"
	StateAccepted         State = "ACCEPTED"
	StatePickupArrived    State = "PICKUP_ARRIVED"
	StatePatientOnboard   State = "PATIENT_ONBOARD"
	StateHospitalSelected State = "HOSPITAL_SELECTED"
	StateInTransit        State = "IN_TRANSIT"
	StateArrived          State = "ARRIVED"
	StateCompleted        State = "COMPLETED"
	StateExpired          State = "EXPIRED"
	StateEscalated        State = "ESCALATED"
	StateReassigning      State = "REASSIGNING"
	StateFailedContact    State = "FAILED_CONTACT"
	StateCancelled        State = "CANCELLED"
)

type ActorType string

const (
	ActorPatient   ActorType = "PATIENT"
	ActorResponder ActorType = "RESPONDER"
	ActorOperator  ActorType = "OPERATOR"
	ActorSystem    ActorType = "SYSTEM"
)

var allowedTransitions = map[State][]State{
	StateCreated: {
		StateDispatching,
		StateCancelled,
	},

	StateDispatching: {
		StateAccepted,
		StateExpired,
		StateEscalated,
		StateCancelled,
	},

	StateExpired: {
		StateEscalated,
		StateCancelled,
	},

	StateEscalated: {
		StateDispatching,
		StateAccepted,
		StateCancelled,
	},

	StateAccepted: {
		StatePickupArrived,
		StateReassigning,
		StateFailedContact,
		StateCancelled,
	},

	StatePickupArrived: {
		StatePatientOnboard,
		StateReassigning,
		StateFailedContact,
		StateCancelled,
	},

	StateReassigning: {
		StateDispatching,
		StateEscalated,
		StateCancelled,
	},

	StateFailedContact: {
		StateAccepted,
		StateReassigning,
		StateEscalated,
		StateCancelled,
	},

	StatePatientOnboard: {
		StateHospitalSelected,
	},

	StateHospitalSelected: {
		StateInTransit,
	},

	StateInTransit: {
		StateArrived,
	},

	StateArrived: {
		StateCompleted,
	},
}

func CanTransition(from, to State) bool {
	destinations, exists := allowedTransitions[from]
	if !exists {
		return false
	}

	for _, destination := range destinations {
		if destination == to {
			return true
		}
	}

	return false
}

func CanActorTransition(actor ActorType, from, to State) bool {
	if !CanTransition(from, to) {
		return false
	}

	switch {
	// System starts dispatch.
	case from == StateCreated && to == StateDispatching:
		return actor == ActorSystem

	// Patient or operator may cancel before boarding.
	case to == StateCancelled:
		return actor == ActorPatient || actor == ActorOperator

	// Responder accepts an offer.
	case from == StateDispatching && to == StateAccepted:
		return actor == ActorResponder

	// System or operator handles dispatch recovery.
	case to == StateExpired:
		return actor == ActorSystem

	case to == StateEscalated:
		return actor == ActorSystem || actor == ActorOperator

	// Dispatcher restarts dispatch or makes a direct assignment.
	case from == StateEscalated &&
		(to == StateDispatching || to == StateAccepted):
		return actor == ActorOperator

	// Responder or operator initiates pre-boarding reassignment.
	case (from == StateAccepted || from == StatePickupArrived) &&
		to == StateReassigning:
		return actor == ActorResponder || actor == ActorOperator

	case from == StateFailedContact && to == StateReassigning:
		return actor == ActorOperator

	// System restarts dispatch after reassignment.
	case from == StateReassigning && to == StateDispatching:
		return actor == ActorSystem

	// Responder records pickup and journey milestones.
	case to == StatePickupArrived,
		to == StatePatientOnboard,
		to == StateInTransit,
		to == StateArrived,
		to == StateCompleted:
		return actor == ActorResponder

	// Failed contact is recorded by the system or operator.
	case to == StateFailedContact:
		return actor == ActorSystem || actor == ActorOperator

	default:
		return false
	}
}
