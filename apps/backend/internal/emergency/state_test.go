package emergency

import "testing"

func TestCanTransition(t *testing.T) {
	tests := []struct {
		name string
		from State
		to   State
		want bool
	}{
		{
			name: "accepted to pickup arrived",
			from: StateAccepted,
			to:   StatePickupArrived,
			want: true,
		},
		{
			name: "accepted to completed is forbidden",
			from: StateAccepted,
			to:   StateCompleted,
			want: false,
		},
		{
			name: "created to dispatching",
			from: StateCreated,
			to:   StateDispatching,
			want: true,
		},
		{
			name: "completed is terminal",
			from: StateCompleted,
			to:   StateCancelled,
			want: false,
		},
		{
			name: "cancelled is terminal",
			from: StateCancelled,
			to:   StateDispatching,
			want: false,
		},
		{
			name: "unknown state is rejected",
			from: State("UNKNOWN"),
			to:   StateDispatching,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CanTransition(tt.from, tt.to)

			if got != tt.want {
				t.Errorf(
					"CanTransition(%q, %q) = %v; want %v",
					tt.from,
					tt.to,
					got,
					tt.want,
				)
			}
		})
	}
}

func TestCanActorTransition(t *testing.T) {
	tests := []struct {
		name  string
		actor ActorType
		from  State
		to    State
		want  bool
	}{
		{
			name:  "system starts dispatch",
			actor: ActorSystem,
			from:  StateCreated,
			to:    StateDispatching,
			want:  true,
		},
		{
			name:  "patient cannot start dispatch",
			actor: ActorPatient,
			from:  StateCreated,
			to:    StateDispatching,
			want:  false,
		},
		{
			name:  "responder accepts offer",
			actor: ActorResponder,
			from:  StateDispatching,
			to:    StateAccepted,
			want:  true,
		},
		{
			name:  "patient cannot accept offer",
			actor: ActorPatient,
			from:  StateDispatching,
			to:    StateAccepted,
			want:  false,
		},
		{
			name:  "patient can cancel before boarding",
			actor: ActorPatient,
			from:  StateAccepted,
			to:    StateCancelled,
			want:  true,
		},
		{
			name:  "patient cannot cancel after boarding",
			actor: ActorPatient,
			from:  StatePatientOnboard,
			to:    StateCancelled,
			want:  false,
		},
		{
			name:  "operator cannot complete journey",
			actor: ActorOperator,
			from:  StateArrived,
			to:    StateCompleted,
			want:  false,
		},
		{
			name:  "responder actor can complete journey",
			actor: ActorResponder,
			from:  StateArrived,
			to:    StateCompleted,
			want:  true,
		},
		{
			name:  "responder cannot reassign after failed contact",
			actor: ActorResponder,
			from:  StateFailedContact,
			to:    StateReassigning,
			want:  false,
		},
		{
			name:  "operator can reassign after failed contact",
			actor: ActorOperator,
			from:  StateFailedContact,
			to:    StateReassigning,
			want:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CanActorTransition(tt.actor, tt.from, tt.to)

			if got != tt.want {
				t.Errorf(
					"CanActorTransition(%q, %q, %q) = %v; want %v",
					tt.actor,
					tt.from,
					tt.to,
					got,
					tt.want,
				)
			}
		})
	}
}
