# AIDORA Emergency State Machine Specification

**Status:** Approved architecture baseline  
**Backend:** Go  
**Architecture:** Modular monolith  
**Related document:** `docs/BACKEND_ARCHITECTURE.md`  
**API contract:** `docs/API_CONTRACTS.md`

## 1. Purpose

The emergency state machine defines the valid lifecycle of an emergency transportation request.

It ensures that:
- An emergency progresses through controlled, valid states.
- Only authorized actors can trigger transitions.
- A responder cannot be assigned to the same emergency alongside another active responder.
- Journey milestones cannot be skipped.
- Recovery and escalation are recorded.
- Every successful transition is auditable.

The backend is responsible for enforcing these rules. The mobile application must not be trusted to enforce them by itself.

## 2. State definitions

### 2.1 Normal journey states

| State | Meaning |
|---|---|
| `CREATED` | The emergency request has been validated and saved. |
| `DISPATCHING` | The system is searching for an eligible responder. |
| `ACCEPTED` | One responder has successfully accepted and been assigned. |
| `PICKUP_ARRIVED` | The assigned responder has reached the pickup location. |
| `PATIENT_ONBOARD` | The patient has entered the responder's vehicle. |
| `HOSPITAL_SELECTED` | The destination healthcare facility has been confirmed. |
| `IN_TRANSIT` | Transportation to the selected facility is underway. |
| `ARRIVED` | The responder and patient have reached the facility. |
| `COMPLETED` | The handover has been recorded and the journey is complete. |

### 2.2 Recovery and intervention states

| State | Meaning |
|---|---|
| `EXPIRED` | The automated dispatch window ended without an accepted offer. |
| `ESCALATED` | Human dispatch intervention is required or has taken responsibility. |
| `REASSIGNING` | An existing responder assignment is being replaced before patient boarding. |
| `FAILED_CONTACT` | The system has established that a required participant cannot currently be reached after an appropriate contact procedure. |

These states are not interchangeable with ordinary connectivity problems. A temporary loss of internet connection alone must not automatically mark an emergency as `FAILED_CONTACT`.

### 2.3 Terminal states

- `COMPLETED`: successful journey completion.
- `CANCELLED`: an authorized cancellation before patient boarding.

A terminal emergency cannot return to an active state. A new emergency must be created if another journey is needed.

## 3. Allowed transitions

The backend must reject transitions that are not listed here.

| Current state | Next state | Authorized actor / trigger |
|---|---|---|
| `CREATED` | `DISPATCHING` | System |
| `CREATED` | `CANCELLED` | Patient or authorized operator |
| `DISPATCHING` | `ACCEPTED` | Eligible responder through atomic offer acceptance |
| `DISPATCHING` | `EXPIRED` | System dispatch timeout |
| `DISPATCHING` | `ESCALATED` | System or authorized operator |
| `DISPATCHING` | `CANCELLED` | Patient or authorized operator |
| `EXPIRED` | `ESCALATED` | System or authorized operator |
| `EXPIRED` | `CANCELLED` | Patient or authorized operator |
| `ESCALATED` | `DISPATCHING` | Authorized dispatcher restarting automated dispatch |
| `ESCALATED` | `ACCEPTED` | Authorized dispatcher assigning a responder |
| `ESCALATED` | `CANCELLED` | Authorized patient or operator |
| `ACCEPTED` | `PICKUP_ARRIVED` | Assigned responder |
| `ACCEPTED` | `REASSIGNING` | Assigned responder or authorized operator |
| `ACCEPTED` | `FAILED_CONTACT` | System or authorized operator after contact procedure |
| `ACCEPTED` | `CANCELLED` | Patient or authorized operator |
| `PICKUP_ARRIVED` | `PATIENT_ONBOARD` | Assigned responder |
| `PICKUP_ARRIVED` | `REASSIGNING` | Assigned responder or authorized operator |
| `PICKUP_ARRIVED` | `FAILED_CONTACT` | System or authorized operator after contact procedure |
| `PICKUP_ARRIVED` | `CANCELLED` | Patient or authorized operator |
| `REASSIGNING` | `DISPATCHING` | System |
| `REASSIGNING` | `ESCALATED` | System or authorized operator |
| `REASSIGNING` | `CANCELLED` | Authorized patient or operator |
| `FAILED_CONTACT` | `ACCEPTED` | Authorized recovery process confirming the original assignment can continue |
| `FAILED_CONTACT` | `REASSIGNING` | Authorized operator or recovery process |
| `FAILED_CONTACT` | `ESCALATED` | System or authorized operator |
| `FAILED_CONTACT` | `CANCELLED` | Authorized patient or operator |
| `PATIENT_ONBOARD` | `HOSPITAL_SELECTED` | Patient or authorized operator |
| `HOSPITAL_SELECTED` | `IN_TRANSIT` | Assigned responder |
| `IN_TRANSIT` | `ARRIVED` | Assigned responder |
| `ARRIVED` | `COMPLETED` | Assigned responder or authorized operator |

No ordinary transition to `REASSIGNING` is permitted after `PATIENT_ONBOARD`. A responder withdrawal or failure after boarding requires a separate safety-aware, human-supervised handover procedure.

## 4. Transition guards

A transition is valid only when both its destination and its conditions are valid.

### 4.1 Emergency creation

Before saving an emergency:
- The patient must exist and be authorized to create the request.
- A valid location description must be supplied.
- GPS coordinates must be valid when the location source is GPS.
- If the source is MANUAL, coordinates must be omitted or null.
- The backend must never invent GPS coordinates.
- An existing active emergency must be checked according to the agreed active-emergency policy.

### 4.2 Responder acceptance

Before accepting an offer:
- The responder must be authenticated.
- The responder must be verified.
- The responder must be eligible and online.
- The offer must belong to that responder.
- The offer must not have expired.
- The emergency must still be eligible for acceptance.
- The responder must not already have an active journey.
- No other responder may already own the active assignment.

Acceptance must be atomic. The backend must use a database transaction and appropriate database constraints or locking so that two simultaneous acceptance requests cannot assign two responders.

### 4.3 Journey milestones

- Only the currently assigned responder can submit ordinary journey milestones.
- Milestones must follow the approved sequence.
- A milestone cannot be repeated to create duplicate state changes.
- `PATIENT_ONBOARD` must occur before facility selection.
- Facility selection must occur before `IN_TRANSIT`.
- `ARRIVED` must occur before `COMPLETED`.

### 4.4 Cancellation

Cancellation is permitted only before patient boarding, subject to authorization and state checks.

The contract explicitly forbids cancellation from:
- `PATIENT_ONBOARD`
- `IN_TRANSIT`
- `ARRIVED`
- `COMPLETED`

The approved design also permits cancellation from the pre-boarding recovery states where the patient or authorized operator is permitted to cancel.

Every cancellation must record its actor and reason. The backend must reject cancellation from a terminal state.

### 4.5 Completion

Completion requires:
- The emergency to be in `ARRIVED`.
- The assigned responder or authorized operator to be acting.
- Handover confirmation to be recorded.
- The completion transition and responder trip-statistic update to be handled reliably.

A repeated completion request must not increment trip statistics more than once.

## 5. Recovery rules

### No responder accepts

`DISPATCHING → EXPIRED → ESCALATED`

The system records dispatch expiry and initiates the human dispatch process. Expiry does not silently delete or complete the emergency.

### Responder withdraws before boarding

`ACCEPTED/PICKUP_ARRIVED → REASSIGNING → DISPATCHING`

If automated reassignment cannot find a suitable responder, the emergency moves to `ESCALATED`.

The previous assignment must remain in the historical record.

### Patient or responder becomes unreachable

The system must apply a defined contact procedure before recording `FAILED_CONTACT`.

A restored connection or successful contact may permit recovery. Otherwise, the emergency may move to `REASSIGNING` or `ESCALATED`, depending on the circumstances.

### Connectivity loss

Temporary connectivity loss is not itself a state transition.

The system should retain last-known location and connection timestamps where available, apply appropriate timeouts, and escalate according to operational policy. It must not fabricate location updates.

### Responder failure after boarding

The ordinary reassignment workflow is not appropriate after `PATIENT_ONBOARD`.

The system must flag the situation for human intervention and follow a safety-aware handover procedure. This requires a separately designed operational workflow.

## 6. Facility selection

The existing responder milestone endpoint does not include `HOSPITAL_SELECTED`.

Facility selection must therefore be handled by a separate operation, rather than pretending it is an ordinary responder milestone.

The selected facility must be recorded against the emergency, including the actor and selection time. The backend must verify that the emergency is in `PATIENT_ONBOARD` before accepting the selection.

The exact facility-selection API and who may authorize a selection must be agreed with the frontend developer before implementation.

## 7. Audit history

Every successful transition must create an immutable history entry containing at least:

- Emergency ID.
- Previous state.
- New state.
- Actor type.
- Actor ID, where applicable.
- Transition timestamp.
- Reason or notes, where applicable.
- Relevant assignment reference, where applicable.

Failed transition attempts should be logged for security and operational diagnosis, without creating false successful state-history entries.

The current emergency state is the current operational value. The history is the durable record of how it reached that state.

## 8. Active emergency policy

The active-emergency query must not simply treat every non-terminal state as active without considering operational meaning.

The implementation must define and test the active-state set. The proposed policy is:

- Active: `CREATED`, `DISPATCHING`, `ACCEPTED`, `PICKUP_ARRIVED`, `PATIENT_ONBOARD`, `HOSPITAL_SELECTED`, `IN_TRANSIT`, `ARRIVED`, `EXPIRED`, `ESCALATED`, `REASSIGNING`, `FAILED_CONTACT`.
- Inactive: `COMPLETED`, `CANCELLED`.

`EXPIRED` remains active because it triggers escalation rather than ending the patient's request.

## 9. Implementation requirements

The Go backend must centralize transition validation in the emergency domain/service layer.

HTTP handlers must not independently implement state-transition rules.

Database writes for a transition must be transactional:
1. Load and lock the emergency record.
2. Verify its current state.
3. Verify actor authorization and transition guards.
4. Update the current state.
5. Insert the audit-history entry.
6. Commit the transaction.

Assignment acceptance and completion/statistic updates require additional safeguards against concurrent or repeated requests.

## 10. Items requiring cross-team confirmation

Before implementation, confirm with the frontend/API owner:

1. The exact facility-selection endpoint and authorized actors.
2. Whether a dispatcher can directly assign a responder from `ESCALATED`.
3. Whether a dispatcher restarting automated dispatch from `ESCALATED` invalidates all previous offers.
4. The precise contact procedure and timeout policy for `FAILED_CONTACT`.
5. The post-boarding responder-failure and handover workflow.
6. The cancellation rules and exact actors for each pre-boarding recovery state.

These details refine the contract; they must not be silently invented by the backend implementation.