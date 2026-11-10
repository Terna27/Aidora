# AIDORA Backend Architecture Blueprint

**Document:** Backend Architecture and Technical Design  
**Project:** AIDORA  
**Status:** Proposed — pending review and approval  
**Backend language:** Go (Golang)  
**Architecture:** Modular Monolith  
**API contract reference:** `docs/API_CONTRACTS.md`

---

## 1. Purpose

This document defines the proposed architecture for the AIDORA backend.

AIDORA is a maternal emergency transportation coordination platform. It connects patients requiring emergency transportation with verified commercial transportation responders and appropriate healthcare facilities.

The backend coordinates the platform's core operations:

- Patient and responder authentication.
- Patient profiles and emergency contacts.
- Responder registration and verification.
- Healthcare facility information.
- Emergency request creation.
- Responder discovery and dispatch.
- Atomic responder assignment.
- Emergency journey tracking.
- Real-time communication.
- Emergency completion, cancellation and escalation.
- Notifications and audit records.

The backend must prioritize reliability, security, privacy, accurate location handling and resilience under poor network conditions.

### 1.1 Important operational principle

AIDORA coordinates transportation; it does not turn commercial drivers or motorcycle riders into medical professionals.

Responders are verified transportation providers. They must never be represented as doctors, nurses or paramedics.

---

## 2. Technology Stack

The following technologies are selected for the initial backend implementation.

| Component | Technology | Responsibility |
|---|---|---|
| Programming language | Go | Backend application |
| HTTP router | Chi | REST API routing and middleware |
| Database | PostgreSQL | Persistent application data |
| Geospatial extension | PostGIS | Location storage and geographic queries |
| Database driver | pgx | PostgreSQL connectivity |
| Query generation | sqlc | Type-safe database queries |
| Migrations | Goose | Database schema versioning |
| Real-time communication | WebSockets | Live emergency updates |
| Authentication | JWT or secure sessions | User authentication |
| Notifications | Firebase Cloud Messaging | Mobile push notifications |
| Testing | Go testing, httptest | Unit and integration tests |
| API documentation | OpenAPI/Swagger | API specification |

Redis may be introduced when a demonstrated requirement justifies it, such as distributed ephemeral coordination or caching.

**PostgreSQL remains the source of truth.** Redis must never become the only place where emergency assignments or critical journey states are stored.

---

## 3. Architectural Style

### 3.1 Modular Monolith

AIDORA will initially use a modular monolith architecture.

This means the backend runs as one application but is organized into separate modules with clear responsibilities.

For example:

- Authentication handles identity and access.
- Emergency handles emergency request lifecycle.
- Dispatch handles responder offers and assignment.
- Facility handles healthcare facility information.
- Journey handles transportation progress.

Modules may communicate through well-defined service interfaces rather than accessing each other's internal implementation directly.

### 3.2 Why a Modular Monolith?

AIDORA does not initially need the operational complexity of microservices.

A modular monolith offers:

- Simpler deployment.
- Easier debugging.
- Fewer infrastructure requirements.
- Straightforward database transactions.
- Clear separation of responsibilities.
- The ability to extract services later if actual scale requires it.

We will avoid premature architectural complexity.

### 3.3 High-level architecture

```text
                    AIDORA MOBILE APP
                   React Native / TypeScript
                              |
                              |
                   REST API + WebSockets
                              |
                              v
                    GO BACKEND APPLICATION
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
        HTTP/API Layer    Service Layer    Realtime Layer
             |                |                |
             +----------------+----------------+
                              |
                       Repository Layer
                              |
                              v
                     PostgreSQL + PostGIS
                              |
                    Optional Infrastructure
                  Redis / Firebase / SMS
```

The HTTP layer handles incoming requests. The service layer enforces business rules. The repository layer handles database operations.

Real-time communication delivers authorized updates to connected clients.

---

## 4. Proposed Backend Directory Structure

The backend will be located inside `apps/backend/`, alongside the existing mobile application.

```text
AIDORA/
|
+-- apps/
|   |
|   +-- mobile/
|   |   +-- Existing frontend files
|   |
|   +-- backend/
|       |
|       +-- cmd/
|       |   +-- api/
|       |       +-- main.go
|       |
|       +-- internal/
|       |   |
|       |   +-- auth/
|       |   +-- patient/
|       |   +-- responder/
|       |   +-- facility/
|       |   +-- emergency/
|       |   +-- dispatch/
|       |   +-- journey/
|       |   +-- realtime/
|       |   +-- notification/
|       |   +-- audit/
|       |   +-- platform/
|       |
|       +-- migrations/
|       |
|       +-- tests/
|       |
|       +-- go.mod
|       +-- go.sum
|       +-- README.md
|
+-- docs/
|   +-- API_CONTRACTS.md
|   +-- BACKEND_ARCHITECTURE.md
|
+-- README.md
```

### 4.1 Directory responsibilities

**cmd/api/**

Contains the application entry point. It initializes configuration, infrastructure dependencies, routes and the HTTP server.

**internal/auth/**

Handles registration, login, token validation, authentication and authorization.

**internal/patient/**

Handles patient profiles and emergency contacts.

**internal/responder/**

Handles responder profiles, registration, verification status and availability.

**internal/facility/**

Handles healthcare facilities, facility capabilities and facility discovery.

**internal/emergency/**

Owns emergency request creation, emergency state transitions, cancellation, dismissal and history.

**internal/dispatch/**

Handles responder discovery, dispatch offers, offer expiration, acceptance, decline and assignment.

**internal/journey/**

Handles responder journey progression and completion.

**internal/realtime/**

Handles WebSocket connections, subscriptions and event delivery.

**internal/notification/**

Handles push notifications and future SMS/USSD integration.

**internal/audit/**

Records important security-sensitive and business-critical events.

**internal/platform/**

Contains shared infrastructure such as configuration, database initialization, logging and HTTP middleware.

These are proposed module boundaries. We will refine them during implementation without creating unnecessary abstractions.

---

## 5. Core Domain Entities

The following entities form the conceptual foundation of the backend database.

| Entity | Responsibility |
|---|---|
| User | Authentication identity and account role |
| PatientProfile | Patient-specific information |
| EmergencyContact | Patient's emergency contacts |
| ResponderProfile | Verified transportation responder information |
| Facility | Healthcare facility details |
| FacilityCapability | Services and emergency capabilities offered by a facility |
| Emergency | Emergency request and lifecycle |
| ResponderLocation | Responder's reported geographic location |
| DispatchOffer | Offer sent to an available responder |
| Assignment | Accepted responder-to-emergency relationship |
| Journey | Transportation journey information |
| FacilityNotification | Facility notification and acknowledgement |
| AuditEvent | Record of important system events |

### 5.1 Important relationships

- A user may have a patient profile or responder profile, depending on their role.
- A patient can create multiple emergency requests over time.
- An emergency may receive multiple dispatch offers.
- An emergency can have only one active responder assignment at a time.
- A responder can receive multiple offers but must not have conflicting active journeys.
- An emergency may involve a destination healthcare facility.
- Important emergency and assignment changes should generate audit records.

The precise foreign keys, cardinalities, indexes and database constraints will be established in the Entity Relationship Diagram (ERD).

---

## 6. Emergency Lifecycle and State Management

Emergency lifecycle management is one of the most important backend responsibilities.

The frontend contract defines the following normal journey:

```text
CREATED
   |
   v
DISPATCHING
   |
   v
ACCEPTED
   |
   v
PICKUP_ARRIVED
   |
   v
PATIENT_ONBOARD
   |
   v
HOSPITAL_SELECTED
   |
   v
IN_TRANSIT
   |
   v
ARRIVED
   |
   v
COMPLETED
```

The contract also defines these exception states:

- CANCELLED
- EXPIRED
- ESCALATED
- REASSIGNING
- FAILED_CONTACT

### 6.1 State transition rules

The backend must enforce valid state transitions.

A client must never be able to update an emergency to an arbitrary state simply by submitting a request.

Every transition must consider:

- Current emergency state.
- Requested target state.
- Authenticated actor.
- Actor's relationship to the emergency.
- Business conditions.
- Whether the transition is permitted.
- Whether the transition must be recorded in the audit log.

### 6.2 Cancellation

The existing API contract permits cancellation before the patient is onboard.

Cancellation must be rejected once the emergency reaches:

- PATIENT_ONBOARD
- IN_TRANSIT
- ARRIVED
- COMPLETED

The backend must enforce this rule in its business logic and protect it against concurrent requests.

### 6.3 Important unresolved state-machine decisions

The existing contract needs clarification in the following areas:

1. Is REASSIGNING a temporary state that returns to DISPATCHING, or does it have another lifecycle?
2. Does ESCALATED represent a continuing emergency managed by a human dispatcher?
3. Is FAILED_CONTACT recoverable, or does it eventually lead to cancellation or escalation?
4. Can a responder or dispatcher initiate reassignment?
5. Who is authorized to select the destination facility?
6. Why does the responder milestone endpoint omit HOSPITAL_SELECTED when the normal journey includes it?
7. Which states are considered active when retrieving a patient's active emergency?

These decisions must be finalized before implementing the state machine.

---

## 7. Dispatch and Assignment Architecture

Dispatch connects an emergency request with a suitable available responder.

### 7.1 Proposed dispatch workflow

```text
Patient creates emergency
          |
          v
Validate emergency request
          |
          v
Save emergency in database
          |
          v
Set state to DISPATCHING
          |
          v
Find eligible nearby responders
          |
          v
Create dispatch offers
          |
          v
Responder receives offer
          |
          v
Responder accepts or declines
          |
          v
Validate offer and responder
          |
          v
Atomic database transaction
          |
          v
Assign exactly one responder
          |
          v
Notify patient and responder
```

### 7.2 Eligibility checks

A responder must satisfy the relevant conditions before receiving or accepting an offer:

- Account exists.
- Verification status is VERIFIED.
- Availability status is ONLINE.
- No conflicting active journey exists.
- Location information is sufficiently recent and usable.
- Responder meets applicable vehicle and operational requirements.

### 7.3 Atomic acceptance

AIDORA must prevent two responders from accepting the same emergency.

The acceptance operation must be protected by a PostgreSQL transaction and appropriate concurrency controls.

The transaction must ensure that:

1. The offer still exists and has not expired.
2. The emergency is still available for assignment.
3. The responder remains eligible.
4. No conflicting assignment exists.
5. Exactly one responder becomes assigned.
6. The emergency and assignment records are updated consistently.

If another responder has already accepted, the competing acceptance must fail with the appropriate contract error.

The database, not the mobile application's countdown or local state, determines whether an offer is still available.

### 7.4 Offer timeout

The existing contract specifies a 45-second offer window.

The backend must enforce expiration using server-side time.

A client-side countdown is only a display feature; it is not an authority for accepting offers.

---

## 8. Database and Geospatial Architecture

PostgreSQL will store persistent application data.

PostGIS will support geographic operations such as:

- Finding nearby responders.
- Finding nearby healthcare facilities.
- Calculating geographic distances.
- Filtering facilities by location and capability.

### 8.1 Location handling

AIDORA supports two location sources:

**GPS location**

The client supplies latitude, longitude, accuracy information and the GPS source.

**Manual location**

The patient supplies a village, community, landmark, address or directions.

Important invariant:

When location source is MANUAL, GPS coordinates must not be fabricated. Coordinates must be absent or null according to the API contract.

### 8.2 Location privacy

Location information is sensitive.

The backend must:

- Restrict access to authorized users.
- Avoid unnecessary location exposure.
- Validate geographic coordinate ranges.
- Track the freshness of responder location updates.
- Avoid exposing one patient's location to unrelated users.
- Define appropriate location retention policies.

---

## 9. Authentication and Authorization

The backend will implement authentication for patients and responders, with administrative or dispatch-operator access where required.

### 9.1 Authentication responsibilities

- Patient registration and login.
- Responder registration and login.
- Secure password storage where passwords are used.
- Token or session validation.
- Token expiration and renewal strategy.
- Logout and session invalidation strategy.

### 9.2 Role-based access

Access must depend on the authenticated user's role and relationship to the requested resource.

Examples:

- Patients can access their own profiles and emergencies.
- Responders can access their own offers and assigned journeys.
- Unverified responders cannot become available.
- Dispatch operators can access only the operations authorized for their role.
- Administrators manage verification and administrative functions.

The backend must derive identity from validated authentication credentials rather than trusting a client-supplied user ID.

### 9.3 Authentication decision still required

The patient registration contract makes passwords optional, while responder registration requires a password.

We must clarify whether patients authenticate through passwords, SMS OTP, or another approved mechanism before finalizing the authentication implementation.

---

## 10. REST API Architecture

The backend will implement the endpoint paths and JSON contracts defined in:

`docs/API_CONTRACTS.md`

The API uses JSON request and response bodies.

### 10.1 Response envelope

Successful response:

```json
{
  "success": true,
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
    "details": {}
  }
}
```

The Go backend must consistently preserve this response structure.

### 10.2 API responsibilities

HTTP handlers should:

1. Receive and decode the request.
2. Validate basic request structure.
3. Identify and authorize the caller.
4. Call the appropriate service.
5. Translate service results into HTTP responses.
6. Return the agreed JSON envelope.

Business rules must live in the service/domain layer rather than being scattered across HTTP handlers.

### 10.3 API compatibility

The backend should preserve the existing contract's:

- Endpoint paths.
- HTTP methods.
- JSON field names.
- Expected response structures.
- Standard error codes.
- Relevant HTTP status codes.

Any intentional API changes must be agreed with the frontend developer and documented.

---

## 11. Real-time Communication

WebSockets will provide live emergency updates.

The existing contract defines these outbound events:

| Event | Purpose |
|---|---|
| emergency.state_changed | Emergency lifecycle update |
| emergency.responder_assigned | Notify patient of assigned responder |
| emergency.responder_location | Responder location and ETA update |
| emergency.facility_selected | Destination facility confirmation |

### 11.1 Real-time architecture

The real-time module will:

- Authenticate WebSocket connections.
- Authorize emergency subscriptions.
- Manage connected clients.
- Publish emergency events.
- Handle disconnections.
- Support reconnection.
- Avoid leaking data across emergency sessions.

### 11.2 Reconnection and missed events

Mobile connectivity may be unreliable.

The backend must not assume that every WebSocket event reaches the client.

After reconnecting, the client should be able to retrieve the latest authoritative emergency state through REST.

We must also define event ordering, duplicate handling and how clients recover from missed updates.

### 11.3 WebSocket authentication

The existing contract supplies a JWT in the WebSocket query string.

Because URLs may be recorded in logs, an alternative authentication mechanism should be evaluated before production deployment.

Any change must be coordinated with the frontend developer.

---

## 12. Notifications and Fallback Communication

Firebase Cloud Messaging will support mobile push notifications.

The notification module will eventually support:

- Emergency creation acknowledgements.
- Responder offer notifications.
- Responder assignment notifications.
- Journey milestone notifications.
- Facility notifications.
- Emergency escalation notifications.

AIDORA must also consider poor network coverage.

Future fallback mechanisms may include:

- SMS.
- USSD.
- Voice communication.
- Human dispatch intervention.

Push notifications and WebSockets must not be treated as the authoritative record of an emergency. Persistent database records remain authoritative.

---

## 13. Auditability and Reliability

Critical operations must be auditable.

Examples include:

- Emergency creation.
- Emergency cancellation.
- Responder verification.
- Offer creation.
- Offer acceptance and decline.
- Responder assignment.
- Journey milestone updates.
- Facility selection.
- Emergency completion.
- Escalation and reassignment.

Audit events should record the actor, action, relevant resource, timestamp and appropriate context.

We must avoid storing unnecessary sensitive information in logs.

### 13.1 Reliability principles

- Use database transactions for critical multi-record operations.
- Validate state transitions.
- Prevent duplicate assignments.
- Handle network failures safely.
- Use appropriate request timeouts.
- Make retry-sensitive operations idempotent where necessary.
- Preserve emergency history.
- Avoid deleting critical records simply because a client dismisses a session.

---

## 14. Testing Strategy

Testing will be introduced alongside each module.

### 14.1 Unit tests

Test business rules independently of HTTP and database infrastructure.

Examples:

- Valid and invalid emergency transitions.
- Responder eligibility.
- Cancellation restrictions.
- Offer expiration.
- Assignment eligibility.
- Journey completion rules.

### 14.2 HTTP tests

Use Go's `httptest` package to test:

- Endpoint behavior.
- Request validation.
- Authentication failures.
- Authorization failures.
- Response envelopes.
- HTTP status codes.

### 14.3 Database integration tests

Test PostgreSQL-dependent operations, particularly:

- Migrations.
- Database constraints.
- Transactions.
- Concurrent offer acceptance.
- Duplicate assignment prevention.
- Geospatial queries.

### 14.4 Integration tests

Test complete workflows involving multiple modules.

Example:

Patient creates emergency → responder receives offer → responder accepts → patient receives assignment event → responder progresses journey → emergency is completed.

---

## 15. Development Roadmap

The backend will be developed incrementally.

| Milestone | Deliverable |
|---|---|
| M0 | Development environment and Git foundation |
| M1 | Architecture, ERD and API specification review |
| M2 | Go application skeleton and health endpoint |
| M3 | PostgreSQL connection and migrations |
| M4 | Authentication and authorization |
| M5 | Patient and responder profiles |
| M6 | Healthcare facilities and capabilities |
| M7 | Geospatial discovery |
| M8 | Emergency creation and state machine |
| M9 | Dispatch offers and atomic assignment |
| M10 | Journey tracking and facility coordination |
| M11 | WebSockets and push notifications |
| M12 | SMS/USSD fallback |
| M13 | Security, reliability and integration testing |
| M14 | Deployment and pilot preparation |

Each milestone must have a defined objective, implementation tasks, tests and completion criteria.

We will not skip ahead simply to produce more code.

---

## 16. Outstanding Architecture Decisions

The following matters require resolution before their respective implementation stages.

| Decision | Why it matters |
|---|---|
| Patient authentication method | Password optionality is not fully explained |
| Emergency state transitions | Exception states and transition rules need clarification |
| Facility selection authority | The contract does not fully define who selects the destination |
| Active emergency definition | Required for reliable active-emergency retrieval |
| Responder reassignment | Requires clear rules for failed or withdrawn assignments |
| Dispatch offer strategy | Need to decide sequential versus parallel offers and timeout behavior |
| WebSocket authentication | Avoid unnecessary exposure of JWTs |
| Human dispatch workflow | Define escalation responsibilities and permissions |
| Location retention | Establish privacy and data-retention rules |
| Notification fallback | Define behavior when push delivery fails |

These are design questions, not reasons to abandon the selected architecture.

---

## 17. Engineering Principles

All backend development should follow these principles:

1. Keep business logic separate from transport and infrastructure code.
2. Prefer simple, readable Go code over unnecessary abstractions.
3. Validate inputs before modifying persistent data.
4. Use database transactions for critical state changes.
5. Enforce authorization at the backend.
6. Never trust client-side state for critical decisions.
7. Preserve audit history.
8. Test failure cases as carefully as successful cases.
9. Maintain compatibility with the agreed frontend API contract.
10. Document significant architectural decisions.

---

## 18. Approval and Implementation Gate

This blueprint establishes the proposed direction for AIDORA's backend.

Before implementation begins, the following must be reviewed and approved:

- [ ] Backend language and technology stack.
- [ ] Modular monolith structure.
- [ ] Backend module responsibilities.
- [ ] Entity Relationship Diagram.
- [ ] Emergency state machine.
- [ ] Dispatch and assignment rules.
- [ ] Authentication and authorization design.
- [ ] API contract compatibility.
- [ ] Security and reliability requirements.

**Implementation begins only after the architecture and critical business rules have been agreed.**

The objective is not simply to make the API work. It is to build a reliable, secure and maintainable emergency transportation coordination system.
