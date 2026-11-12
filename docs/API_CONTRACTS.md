# AIDORA Backend API Contracts & Integration Guide

**Platform:** AIDORA — Maternal Emergency Transportation Coordination  
**Backend:** Go (Golang)  
**Frontend:** React Native + TypeScript  
**Database:** PostgreSQL + PostGIS  
**Architecture:** Modular monolith  
**Protocol:** RESTful JSON over HTTPS and WebSocket Secure (WSS) for real-time emergency updates  
**API Version:** v1  
**Audience:** Frontend, backend, mobile and integration developers

**Domain boundary:** AIDORA coordinates emergency transportation between patients, verified commercial transportation responders and healthcare facilities. Responders are transportation providers, not doctors, nurses, paramedics or other medical professionals. AIDORA does not replace emergency medical services or clinical care.

---

## 1. API-Wide Conventions

### 1.1 Base URL and versioning

All REST endpoints use the `/api/v1` prefix.

Development example:

`http://localhost:8080/api/v1`

Production deployments must use HTTPS. Real-time connections must use WSS.

### 1.2 Request and response format

- Request and response bodies use JSON.
- JSON property names use `camelCase`.
- Request bodies must declare `Content-Type: application/json`.
- Responses use `application/json`.
- Timestamps use ISO 8601 / RFC 3339 in UTC.
- API enum values use uppercase strings unless an endpoint explicitly defines otherwise.
- Unknown or unsupported enum values must be rejected rather than silently accepted.

### 1.3 Standard success envelope

All successful REST responses use:

```json
{
  "success": true,
  "data": {}
}
```

The `data` property contains the endpoint-specific response.

For endpoints that return no resource data, use an empty object rather than omitting the property.

### 1.4 Standard error envelope

All API errors use:

```json
{
  "success": false,
  "error": {
    "code": "ACTIVE_EMERGENCY_EXISTS",
    "message": "You already have an active emergency request.",
    "details": {}
  }
}
```

- `code`: Stable machine-readable error identifier.
- `message`: Human-readable explanation.
- `details`: Optional structured information useful to the frontend. When no additional information exists, return an empty object.

Frontend applications should use the error `code` for programmatic handling rather than depending on message text.

### 1.5 HTTP status conventions

| HTTP status | Meaning |
|---|---|
| 200 OK | Successful request |
| 201 Created | Resource successfully created |
| 202 Accepted | Request accepted for asynchronous processing |
| 204 No Content | Successful request with no response body, only where explicitly specified |
| 400 Bad Request | Invalid request or invalid state transition |
| 401 Unauthorized | Missing, invalid or expired authentication |
| 403 Forbidden | Authenticated user lacks permission |
| 404 Not Found | Resource does not exist or is not accessible to the caller |
| 409 Conflict | Request conflicts with the current resource or system state |
| 422 Unprocessable Content | Well-formed request that fails domain validation |
| 429 Too Many Requests | Rate limit exceeded |
| 500 Internal Server Error | Unexpected server failure |
| 503 Service Unavailable | Required service temporarily unavailable |

### 1.6 Resource identifiers

- Database primary keys use UUID.
- Public API resource identifiers are UUID strings.
- The same identifier must be used consistently across related endpoints and WebSocket events.
- Frontend applications must treat identifiers as opaque strings and must not assume a particular UUID structure beyond the API contract.

### 1.7 Authentication and sessions

Protected endpoints require:

`Authorization: Bearer <access_token>`

Authentication follows these principles:

- Access tokens are short-lived JWTs.
- Refresh tokens are opaque, securely generated and rotated after successful refresh.
- Refresh sessions are tracked and revocable by the backend.
- Logout revokes the relevant refresh session.
- Patient, responder and administrator permissions are enforced by the backend.
- A user must not gain access to another user's resource by supplying or guessing its identifier.
- Refresh tokens must be stored securely by the mobile application.

Exact token lifetimes and refresh-session expiry policies will be defined in the authentication implementation specification.

### 1.8 Identity and authorization

The backend derives the authenticated user's identity and roles from the validated access token and associated server-side records.

Clients must not be trusted to establish their own identity by submitting user IDs.

For example, emergency creation must derive `patientId` from the authenticated patient rather than trusting a `patientId` supplied in the request body.

Every protected operation must verify both authentication and resource-level authorization.

### 1.9 Idempotency and duplicate requests

Operations that can create safety-critical resources must protect against duplicate submissions caused by network retries.

`POST /api/v1/emergencies` must support an `Idempotency-Key` request header.

The backend must ensure that retrying the same operation with the same key does not create multiple emergency requests.

Idempotency records must be scoped to the authenticated user and retained for a documented period.

### 1.10 Time and audit conventions

- The backend generates authoritative timestamps.
- Timestamps are stored using PostgreSQL `TIMESTAMPTZ`.
- API timestamps are returned in UTC using RFC 3339.
- Client-provided timestamps must not determine authoritative emergency transitions, offer expiry or handover completion.
- Important operational actions must retain an auditable history.

### 1.11 Error code conventions

The API uses stable uppercase error codes.

Initial common error codes include:

| Error code | HTTP status | Meaning |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Authentication is missing or invalid |
| `FORBIDDEN` | 403 | Operation is not permitted |
| `VERIFICATION_REQUIRED` | 403 | Responder is not verified |
| `NOT_FOUND` | 404 | Resource does not exist or is inaccessible |
| `VALIDATION_ERROR` | 422 | Request fails domain validation |
| `ACTIVE_EMERGENCY_EXISTS` | 409 | Patient already has an active emergency |
| `ACTIVE_JOURNEY_EXISTS` | 409 | Responder already has an active journey |
| `CANCELLATION_FORBIDDEN` | 409 | Emergency is not in a cancellable state |
| `INVALID_STATE_TRANSITION` | 409 | Requested state transition is not permitted |
| `DISPATCH_UNAVAILABLE` | 503 | Dispatch service is temporarily unavailable |
| `RATE_LIMIT_EXCEEDED` | 429 | Request limit exceeded |

Endpoint-specific error codes will be defined in their respective sections.

## 2. Emergency State Machine

The emergency state machine defines the authoritative lifecycle of every AIDORA emergency request.

The backend is the source of truth for emergency status and permitted transitions. The frontend displays the current backend state and must not independently advance, reverse, or invent emergency states.

### 2.1 Canonical Emergency States

AIDORA uses the following 14 emergency states:

| State | Meaning |
|---|---|
| `CREATED` | Emergency request has been successfully created and recorded. |
| `DISPATCHING` | Backend is searching for and notifying eligible responders. |
| `ACCEPTED` | A responder has accepted the emergency and has been assigned to it. |
| `PICKUP_ARRIVED` | Assigned responder has arrived at the patient's pickup location. |
| `PATIENT_ONBOARD` | Patient has boarded the assigned responder's vehicle. |
| `HOSPITAL_SELECTED` | A receiving healthcare facility has been selected and recorded for the journey. |
| `IN_TRANSIT` | Responder is transporting the patient to the designated facility. |
| `ARRIVED` | Responder has arrived at the receiving facility. |
| `COMPLETED` | Operational handover has been recorded and the journey has been explicitly completed. |
| `CANCELLED` | Emergency request was validly cancelled before patient boarding. |
| `EXPIRED` | No responder accepted the emergency within the configured dispatch acceptance period. |
| `ESCALATED` | Emergency has been transferred to an authorised human dispatch process because automated handling requires intervention. |
| `REASSIGNING` | Backend is finding a replacement responder following a valid pre-boarding assignment failure. |
| `FAILED_CONTACT` | A confirmed communication failure has occurred that requires intervention. |

These states are backend domain states. The frontend may use additional display labels, but those labels must not be persisted as separate backend states.

### 2.2 Normal Emergency Journey

The expected journey is:

`CREATED → DISPATCHING → ACCEPTED → PICKUP_ARRIVED → PATIENT_ONBOARD → [HOSPITAL_SELECTED] → IN_TRANSIT → ARRIVED → COMPLETED`

`HOSPITAL_SELECTED` is an optional state in the displayed journey because the receiving facility may already have been selected earlier. However, a valid receiving facility must be established and recorded before the patient is transported.

The backend must enforce valid state transitions. Clients must not skip required milestones or directly update emergency status.

### 2.3 State Transition Rules

The following rules govern normal and exceptional transitions.

| Current state | Permitted next state(s) | Conditions |
|---|---|---|
| `CREATED` | `DISPATCHING`, `CANCELLED` | Dispatch may begin, or the patient may cancel before dispatch. |
| `DISPATCHING` | `ACCEPTED`, `EXPIRED`, `CANCELLED`, `ESCALATED` | A responder accepts, the acceptance period expires, the patient cancels, or automated dispatch requires human intervention. |
| `ACCEPTED` | `PICKUP_ARRIVED`, `REASSIGNING`, `CANCELLED`, `FAILED_CONTACT`, `ESCALATED` | Assignment is active. Reassignment is permitted only before boarding. |
| `PICKUP_ARRIVED` | `PATIENT_ONBOARD`, `REASSIGNING`, `CANCELLED`, `FAILED_CONTACT`, `ESCALATED` | Patient boards, or a confirmed pre-boarding failure requires intervention. |
| `PATIENT_ONBOARD` | `HOSPITAL_SELECTED`, `IN_TRANSIT`, `FAILED_CONTACT`, `ESCALATED` | No automatic reassignment is permitted after boarding. |
| `HOSPITAL_SELECTED` | `IN_TRANSIT`, `FAILED_CONTACT`, `ESCALATED` | A receiving facility is recorded and the journey proceeds, or intervention is required. |
| `IN_TRANSIT` | `ARRIVED`, `FAILED_CONTACT`, `ESCALATED` | Responder reaches the facility, or a confirmed communication or operational incident requires intervention. |
| `ARRIVED` | `COMPLETED`, `FAILED_CONTACT`, `ESCALATED` | Operational handover is completed, or intervention is required. |
| `EXPIRED` | `ESCALATED` | Dispatch timeout requires human dispatch intervention. |
| `REASSIGNING` | `DISPATCHING`, `ESCALATED` | A replacement search resumes or automated reassignment fails and requires human intervention. |
| `FAILED_CONTACT` | `ESCALATED` | Confirmed contact failure requires human dispatch intervention. |
| `ESCALATED` | `DISPATCHING`, or an authorised resolution path | Only an authorised dispatcher may return an eligible pre-boarding emergency to automated dispatch. |

`COMPLETED` and `CANCELLED` are terminal states. They cannot be reopened through ordinary client operations.

`EXPIRED` records the failed automated acceptance attempt. The backend must then escalate the emergency when human intervention is required. The transition and its timestamps must remain in the emergency history.

### 2.4 Patient Boarding and Reassignment Safety Rule

**Automatic responder reassignment is permitted only before the emergency reaches `PATIENT_ONBOARD`.**

Once the emergency reaches `PATIENT_ONBOARD`, automatic reassignment is permanently prohibited for that journey.

This restriction exists because the backend cannot safely assume that a patient has not boarded merely because a responder reports a problem or loses connectivity.

If the assigned responder becomes unable to continue after boarding:

1. Preserve the original responder assignment.
2. Record the operational incident and its timestamp.
3. Escalate the emergency to an authorised human dispatcher.
4. Allow the dispatcher to coordinate a safe alternative transport arrangement.
5. Preserve the original journey, responder assignment, milestones, and incident history.
6. Do not silently replace the original responder or treat the incident as an ordinary dispatch retry.

Any alternative transport arrangement after boarding must be handled through an authorised human intervention process with its own auditable records. It must not erase or rewrite the original journey.

### 2.5 Cancellation Rules

A patient may cancel an emergency only while it is in one of these states:

- `CREATED`
- `DISPATCHING`
- `ACCEPTED`
- `PICKUP_ARRIVED`

Cancellation must be rejected once the emergency reaches `PATIENT_ONBOARD` or any later state.

The backend must enforce this allowlist regardless of frontend controls.

A rejected cancellation must return:

- HTTP `409 Conflict`
- Error code `CANCELLATION_FORBIDDEN`

A successful cancellation must record the cancellation timestamp, initiating actor, and optional reason.

Cancellation must not delete the emergency record or its history.

### 2.6 Facility Selection and Transport Requirements

A valid receiving healthcare facility must be established before the patient begins transport.

The backend must:

- Validate that the selected facility exists.
- Verify that the facility is eligible to receive the emergency according to its current operational status and relevant capabilities.
- Record the facility selection against the emergency.
- Preserve the actor and timestamp associated with the selection.
- Notify authorised participants when the facility is selected or changed.

`HOSPITAL_SELECTED` is optional as a separate journey milestone, but facility selection itself is not optional.

The authorised actor and API operation responsible for initial facility selection and subsequent changes must be explicitly defined in the API contract before implementation. The backend must not assume that the patient or responder can select or change a facility without an agreed permission rule.

A facility change after transport has begun must be treated as an auditable operational decision, not an ordinary client-side field update.

### 2.7 Dispatch Expiration, Reassignment, and Escalation

The backend dispatch engine owns:

- Offer expiration.
- Responder eligibility checks.
- Responder selection.
- Dispatch retry limits.
- Assignment conflict prevention.
- Pre-boarding reassignment.
- Human escalation when automated dispatch cannot safely continue.

A responder offer must have a server-authoritative expiration timestamp. The frontend countdown is informational and must not determine whether an offer is still valid.

The offer timeout must be finalised jointly with the frontend team because the original API guide specifies 45 seconds while the latest frontend implementation reports a 30-second countdown.

The backend must reject expired offers and offers already accepted by another responder.

If a responder becomes unavailable before boarding, the backend may enter `REASSIGNING` and search for a replacement. If no suitable replacement is found within the configured retry policy, the emergency must enter `ESCALATED`.

After `PATIENT_ONBOARD`, automated reassignment must never occur.

An authorised dispatcher may resume automated dispatch only where the emergency is still eligible for pre-boarding reassignment. Such a decision must be recorded in the audit history.

### 2.8 Failed Contact and Network Interruption

`FAILED_CONTACT` represents a confirmed communication failure requiring operational intervention. It must not be used merely because a mobile device temporarily loses internet connectivity.

The backend must distinguish between:

- Temporary network interruption.
- Delayed location updates.
- Missed WebSocket messages.
- Confirmed inability to contact a patient or responder.
- An operational incident requiring human intervention.

Temporary connectivity loss must not automatically change the emergency state or trigger responder reassignment.

When contact failure is confirmed:

- Record the affected participant, detection time, and relevant evidence.
- Preserve the current responder assignment and journey history.
- Transition to `FAILED_CONTACT` where appropriate.
- Escalate to `ESCALATED` when human intervention is required.

For emergencies already at or beyond `PATIENT_ONBOARD`, contact failure must never trigger automatic reassignment.

### 2.9 Human Escalation and Recovery

`ESCALATED` indicates that an emergency requires an authorised human dispatch process.

Escalation may occur when:

- No eligible responder accepts an emergency.
- Automated dispatch exhausts its retry policy.
- A responder becomes unavailable before patient boarding and replacement dispatch fails.
- A confirmed contact failure requires intervention.
- A post-boarding operational incident requires safe coordination.
- Another safety-critical condition prevents automated handling.

Only authorised dispatch personnel may perform privileged recovery actions.

A dispatcher may return an emergency to automated dispatch only when the current journey state and patient safety conditions permit it. In particular, an emergency that has reached `PATIENT_ONBOARD` must not be returned to ordinary automated reassignment.

Every escalation and recovery action must record:

- Emergency ID.
- Previous state and resulting state.
- Actor ID and actor role.
- Timestamp.
- Reason for the action.
- Relevant operational notes.

### 2.10 Audit History and State Integrity

Every successful state transition must create an immutable history record containing:

- Emergency ID.
- Previous state.
- New state.
- Actor ID, where applicable.
- Actor role or system identity.
- Timestamp generated by the backend.
- Reason or transition note, where applicable.

The backend must reject invalid transitions and prevent clients from directly writing arbitrary emergency states.

State changes and their corresponding history records must be committed atomically in the database.

Concurrent requests must not allow two responders to accept the same emergency or produce conflicting journey transitions.

The original assignment, reassignment attempts, cancellation decisions, escalation actions, facility selections, operational incidents, and handover records must remain auditable.

### 2.11 WebSocket and State Recovery

WebSocket events communicate state changes to connected clients, but they are not the authoritative emergency record.

The backend must:

- Publish events only after the corresponding database transaction commits.
- Include the emergency ID and server-generated timestamp in state-change events.
- Preserve event ordering where practical.
- Support reconnection and recovery through an authoritative REST snapshot.
- Avoid interpreting a missed WebSocket event as a state transition failure.
- Ensure that a client reconnecting can retrieve the latest emergency state and relevant journey information.

Temporary disconnection must not change emergency ownership, responder assignment, or the persisted emergency state.

### 2.12 Frontend Display Mapping

The frontend may present human-readable labels that differ from backend state names.

For example:

| Backend state | Suggested frontend display |
|---|---|
| `CREATED` | Request Created |
| `DISPATCHING` | Finding a Responder |
| `ACCEPTED` | Responder Assigned / En Route to Pickup |
| `PICKUP_ARRIVED` | Responder Arrived |
| `PATIENT_ONBOARD` | Patient Picked Up |
| `HOSPITAL_SELECTED` | Facility Selected |
| `IN_TRANSIT` | On the Way to Facility |
| `ARRIVED` | Arrived at Facility |
| `COMPLETED` | Journey Completed |
| `CANCELLED` | Request Cancelled |
| `EXPIRED` | No Responder Accepted |
| `ESCALATED` | Human Dispatch Assistance |
| `REASSIGNING` | Finding a Replacement Responder |
| `FAILED_CONTACT` | Contact Assistance Required |

The label `En Route to Pickup` is a frontend display for backend state `ACCEPTED`. It is not an additional backend state.

The frontend must not assume that every exceptional state will be exercised through the normal patient journey screens. It must nevertheless handle backend state updates safely and display appropriate information when an exceptional state occurs.

## 3. Authentication and Authorization

AIDORA uses authenticated API access and role-based authorization to protect patient information, responder operations, emergency coordination, and administrative functions.

The backend is responsible for validating identities, issuing and revoking credentials, enforcing permissions, and recording security-sensitive actions.

Authentication does not automatically grant permission to perform every operation. Each request must be authorised according to the authenticated user's roles, account status, resource ownership, and the operation being requested.

### 3.1 Supported User Roles

AIDORA supports three primary roles:

| Role | Responsibilities |
|---|---|
| `patient` | Register and manage a patient profile, create emergencies, view personal emergency history, and manage emergency contacts. |
| `responder` | Register as a transportation responder, manage availability, receive and respond to offers, and update authorised journey milestones. |
| `admin` | Manage platform operations, users, responder verification, facilities, dispatch oversight, and authorised emergency interventions. |

A user may have more than one role. The backend must therefore support multiple roles for a single account rather than assuming that every account has exactly one role.

Possession of a role does not bypass resource-level authorization. For example, a patient may access only their own profile and emergency records unless an explicitly authorised administrative operation applies.

### 3.2 Authentication Methods

AIDORA supports authenticated access using:

- Phone number as the primary account identifier.
- Password-based authentication where enabled for the account.
- One-time password (OTP) verification for supported phone verification and account recovery workflows.
- Short-lived access tokens for API authentication.
- Opaque, rotating refresh tokens for session renewal.

The exact OTP provider, delivery mechanism, password policy, and account recovery rules must be specified in the authentication implementation design.

The backend must never store passwords in plaintext. Passwords must be stored using an appropriate password-hashing algorithm with secure parameters.

OTP values must be time-limited, single-use, and protected against brute-force attempts.

### 3.3 Access Token Requirements

After successful authentication, the backend issues an access token.

Access tokens:

- Must be short-lived.
- Must be signed and validated by the backend.
- Must identify the authenticated user.
- Must include or resolve the user's authorised roles.
- Must not contain passwords, OTP values, or sensitive medical information.
- Must be transmitted over HTTPS.
- Must be sent through the HTTP Authorization header.

Required request header:

`Authorization: Bearer <access_token>`

The backend must reject missing, malformed, invalid, expired, or revoked authentication credentials.

Authentication failures must return HTTP `401 Unauthorized` with error code `UNAUTHENTICATED`.

### 3.4 Refresh Token Requirements

Refresh tokens are opaque credentials used to obtain new access tokens without requiring the user to authenticate again.

The backend must:

- Generate refresh tokens using a cryptographically secure random source.
- Store only a secure representation or hash of each refresh token.
- Rotate refresh tokens when they are successfully used.
- Invalidate the previous refresh token after rotation.
- Associate sessions with the relevant user and device or session identifier.
- Support session revocation.
- Detect reuse of an already-rotated refresh token and apply the agreed token-family revocation policy.

A refresh token must not be accepted as an access token.

Exact access-token lifetime, refresh-token lifetime, rotation policy, and reuse-response policy must be finalised in the authentication implementation specification.

### 3.5 Authentication Endpoints

#### 3.5.1 Patient Registration

`POST /api/v1/auth/register`

Creates a patient account.

Request body:

```json
{
  "fullName": "Jane Doe",
  "phoneNumber": "+2348012345678",
  "password": "secure-password",
  "communityOrVillage": "Example Community",
  "emergencyContacts": [
    {
      "name": "John Doe",
      "phoneNumber": "+2348098765432",
      "relationship": "Spouse",
      "isPrimary": true
    }
  ]
}
```

The password field and its optionality must be aligned with the final patient authentication method.

The backend must validate required fields, phone number format, duplicate accounts, and emergency contact data.

Successful registration returns HTTP `201 Created`.

The response must include the authenticated account information and session credentials only if registration also establishes an authenticated session.

#### 3.5.2 Patient Login

`POST /api/v1/auth/login`

Authenticates a patient using the configured authentication method.

The backend must validate credentials, confirm that the account is eligible to authenticate, and issue session credentials.

Successful authentication returns HTTP `200 OK`.

#### 3.5.3 Responder Registration

`POST /api/v1/responder/auth/register`

Creates a responder account.

Request body:

```json
{
  "fullName": "John Responder",
  "phoneNumber": "+2348012345678",
  "password": "secure-password",
  "vehicleType": "MOTORCYCLE",
  "vehicleMakeModel": "Example Motorcycle",
  "licensePlate": "ABC-123-XY",
  "vehicleColor": "Black",
  "driverLicenseNumber": "LICENSE-REFERENCE",
  "communityBase": "Example Community",
  "agreedToTerms": true
}
```

The backend must validate responder registration details and record the responder's acceptance of the platform terms.

Responder accounts must not automatically receive permission to accept emergency offers.

A newly registered responder must undergo the required verification process before becoming eligible for dispatch.

#### 3.5.4 Responder Login

`POST /api/v1/responder/auth/login`

Authenticates a responder.

Successful authentication returns session credentials and the responder's current verification and availability information.

A responder's ability to authenticate must be distinguished from eligibility to receive emergency offers.

For example, a pending responder may be permitted to log in and view verification status but must not be permitted to go online or accept offers.

#### 3.5.5 Refresh Session

`POST /api/v1/auth/refresh`

Exchanges a valid refresh token for a new access token and rotated refresh token.

The backend must reject expired, revoked, malformed, or previously rotated refresh tokens.

The request must not require an access token that has already expired.

#### 3.5.6 Logout

`POST /api/v1/auth/logout`

Revokes the current authenticated session or refresh-token family according to the agreed session policy.

Logout must be idempotent: repeating a logout request must not restore or extend the revoked session.

#### 3.5.7 Password Recovery

`POST /api/v1/auth/forgot-password`

Initiates the account recovery process using the registered phone number and the configured OTP mechanism.

The response must not reveal whether an account exists.

`POST /api/v1/auth/reset-password`

Completes password recovery after successful verification.

The backend must invalidate affected sessions according to the agreed recovery policy and prevent reuse of expired or previously consumed OTP values.

### 3.6 Authorization Rules

The backend must enforce authorization on every protected endpoint.

| Operation | Patient | Responder | Admin |
|---|---|---|---|
| View own profile | Allowed | Allowed | Allowed |
| Update own profile | Allowed | Allowed | Authorised administrative action |
| Create emergency | Allowed | Not allowed | Only through authorised operational workflow |
| View own emergency | Allowed | Only when assigned or otherwise authorised | Allowed for authorised oversight |
| Cancel own emergency | Allowed within permitted states | Not allowed | Authorised intervention |
| View active responder offers | Not allowed | Allowed if eligible | Authorised oversight |
| Accept or decline an offer | Not allowed | Allowed if eligible and offer is valid | Not as an ordinary responder action |
| Update assigned journey milestones | Not allowed | Allowed when assigned and transition is valid | Authorised intervention |
| Record operational handover | Not allowed | Allowed when assigned and journey is `ARRIVED` | Authorised intervention |
| Manage responder verification | Not allowed | Not allowed | Allowed |
| Manage facilities | Not allowed | Not allowed | Allowed |
| Perform emergency escalation or recovery | Not allowed | Not allowed | Allowed when authorised |

This table is the baseline permission model. Any additional administrative or facility-operator permissions must be explicitly defined rather than assumed.

### 3.7 Responder Verification and Eligibility

Responder account verification and responder availability are separate concepts.

The frontend currently uses these verification labels:

- `PENDING`
- `VERIFIED`
- `UNVERIFIED`
- `SUSPENDED`

The canonical backend verification states and their transition rules must be confirmed jointly with the frontend team before implementation.

Availability is represented separately:

- `ONLINE`
- `OFFLINE`

Only a responder with backend verification status `VERIFIED` may become `ONLINE` or receive dispatch offers.

The backend must reject attempts by ineligible responders to:

- Go online.
- Receive new offers.
- Accept an offer.
- Start a new journey.

A responder with an active journey must not receive or accept another emergency offer.

Suspended responders must not participate in dispatch, even if an earlier session remains authenticated.

### 3.8 Resource Ownership and Identity Validation

The backend must derive the authenticated user identity from the validated access token or server-side session.

Sensitive operations must not trust user IDs supplied in request bodies or URL parameters as proof of ownership.

For example:

- Emergency creation must associate the emergency with the authenticated patient.
- Patient profile operations must target the authenticated patient's own profile.
- A responder may update a journey only when assigned to that emergency.
- A patient may cancel only their own emergency and only while cancellation is permitted.
- Administrative operations must verify the administrator's required permissions.

Where an endpoint accepts a resource ID, the backend must verify that the authenticated actor is authorised to access or modify that resource.

Unauthorised resource access must not disclose another user's private information.

### 3.9 Session and Credential Security

The backend must:

- Require HTTPS in production.
- Avoid logging passwords, access tokens, refresh tokens, OTP values, or other authentication secrets.
- Apply rate limits to login, registration, OTP, and password recovery endpoints.
- Protect against brute-force login and OTP verification attempts.
- Use secure password hashing.
- Support session revocation.
- Validate token expiry and signature on every authenticated request.
- Return consistent authentication and authorization errors.
- Record security-sensitive account and session actions in an audit trail.

WebSocket authentication must follow the same identity and authorization principles. Long-lived access tokens must not be placed in WebSocket URL query strings. The final WebSocket ticket mechanism is specified in the real-time communication section.

### 3.10 Authentication and Authorization Error Responses

| Condition | HTTP status | Error code |
|---|---:|---|
| Missing or invalid authentication | 401 | `UNAUTHENTICATED` |
| Authenticated user lacks permission | 403 | `FORBIDDEN` |
| Responder verification required | 403 | `VERIFICATION_REQUIRED` |
| Invalid login credentials | 401 | `INVALID_CREDENTIALS` |
| Duplicate account identifier | 409 | `ACCOUNT_ALREADY_EXISTS` |
| Expired or invalid refresh token | 401 | `INVALID_REFRESH_TOKEN` |
| Revoked session | 401 | `SESSION_REVOKED` |
| Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` |

Error responses must use the standard error envelope defined in Section 1.

### 3.11 Audit Requirements

The backend must maintain auditable records for security-sensitive operations, including:

- Account registration.
- Successful and failed authentication attempts, subject to privacy-conscious retention.
- Password recovery and password changes.
- Session creation, refresh, and revocation.
- Role assignment and removal.
- Responder verification and suspension.
- Privileged administrative actions.

Audit records must include the relevant actor, action, timestamp, and outcome. Authentication secrets must never be included in audit records.

## 4. Patient APIs

Patient APIs allow authenticated patients to manage their personal profiles and emergency contacts.

All endpoints in this section require a valid patient access token unless explicitly stated otherwise.

The backend must derive the patient identity from the authenticated principal. A client must not be allowed to access another patient's information by supplying a different patient ID.

### 4.1 Patient Profile

#### 4.1.1 Get Patient Profile

`GET /api/v1/patient/profile`

Retrieves the authenticated patient's profile.

**Authorization:** Authenticated patient.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Jane Doe",
    "phoneNumber": "+2348012345678",
    "communityOrVillage": "Example Community",
    "gestationalAgeWeeks": 28,
    "bloodGroup": "O+",
    "allergiesOrNotes": "Example patient-provided information",
    "emergencyContacts": [
      {
        "id": "650e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "phoneNumber": "+2348098765432",
        "relationship": "Spouse",
        "isPrimary": true
      }
    ],
    "createdAt": "2026-11-12T10:00:00Z",
    "updatedAt": "2026-11-12T10:00:00Z"
  }
}
```

The response must contain only information belonging to the authenticated patient.

Sensitive patient information, including blood group, allergies, and pregnancy-related information, must not be exposed to responders through ordinary responder profile or journey endpoints.

#### 4.1.2 Update Patient Profile

`PUT /api/v1/patient/profile`

Updates the authenticated patient's profile.

**Authorization:** Authenticated patient.

**Request body:**

```json
{
  "fullName": "Jane Doe",
  "phoneNumber": "+2348012345678",
  "communityOrVillage": "Updated Community",
  "gestationalAgeWeeks": 29,
  "bloodGroup": "O+",
  "allergiesOrNotes": "Updated patient-provided information"
}
```

**Success response:** HTTP `200 OK`.

The backend must:

- Validate all submitted fields.
- Reject invalid phone numbers.
- Enforce phone number uniqueness across accounts.
- Validate gestational age where supplied.
- Apply appropriate length limits to text fields.
- Update the server-generated `updatedAt` timestamp.
- Preserve the existing profile when validation fails.

A duplicate phone number must return HTTP `409 Conflict` with error code `ACCOUNT_ALREADY_EXISTS`.

The update operation must not permit modification of account roles, verification status, internal identifiers, or other server-controlled fields.

### 4.2 Emergency Contacts

Emergency contacts are people the patient designates to be contacted when necessary during an emergency coordination process.

Emergency contact information must be handled as private patient data and must not be exposed to responders by default.

#### 4.2.1 Add Emergency Contact

`POST /api/v1/patient/emergency-contacts`

Adds an emergency contact to the authenticated patient's account.

**Authorization:** Authenticated patient.

**Request body:**

```json
{
  "name": "John Doe",
  "phoneNumber": "+2348098765432",
  "relationship": "Spouse",
  "isPrimary": true
}
```

**Success response:** HTTP `201 Created`.

```json
{
  "success": true,
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "phoneNumber": "+2348098765432",
    "relationship": "Spouse",
    "isPrimary": true,
    "createdAt": "2026-11-12T10:00:00Z"
  }
}
```

The backend must:

- Validate the contact name and phone number.
- Validate the relationship field.
- Associate the contact with the authenticated patient.
- Generate the contact ID on the server.
- Enforce the agreed emergency-contact limit.
- Prevent duplicate or conflicting contact records according to the agreed contact policy.

If a new contact is marked as primary, the backend must ensure that the patient has only one primary emergency contact.

Changing the primary contact must be handled atomically so that a patient cannot end up with multiple primary contacts or no primary contact due to a partially completed operation.

The maximum number of emergency contacts and duplicate-contact policy must be finalised before implementation.

#### 4.2.2 Delete Emergency Contact

`DELETE /api/v1/patient/emergency-contacts/{id}`

Deletes an emergency contact belonging to the authenticated patient.

**Authorization:** Authenticated patient who owns the contact.

**Success response:** HTTP `204 No Content`.

The backend must:

- Validate the contact ID.
- Confirm that the contact belongs to the authenticated patient.
- Reject attempts to delete another patient's contact.
- Return `404 Not Found` when the contact does not exist or is not accessible to the authenticated patient.
- Preserve unrelated emergency contacts.

If the contact being deleted is the primary contact, the backend must apply the agreed primary-contact policy. It must not silently designate another contact as primary without an explicit rule.

Deleting an emergency contact must not erase historical emergency records or audit information that legitimately references the contact.

### 4.3 Patient Data Privacy and Access Boundaries

Patient profiles may contain personal and sensitive information.

The backend must apply the following restrictions:

1. Patients may retrieve and update only their own profiles.
2. Patients may add and delete only their own emergency contacts.
3. Responders must not receive unrestricted access to patient profile data.
4. Responders must not receive blood group, allergies, gestational age, or private patient notes through ordinary dispatch and journey responses.
5. Administrative access to sensitive patient data must be restricted to authorised operational or administrative purposes.
6. Access to sensitive information must be auditable.
7. Sensitive data must not be included unnecessarily in WebSocket events, push notifications, application logs, or analytics.

AIDORA coordinates transportation. It is not a clinical record system and must not expose sensitive medical information merely because a responder is assigned to a journey.

### 4.4 Validation and Error Responses

Patient API endpoints must use the standard error envelope defined in Section 1.

| Condition | HTTP status | Error code |
|---|---:|---|
| Missing or invalid authentication | 401 | `UNAUTHENTICATED` |
| Authenticated user is not a patient | 403 | `FORBIDDEN` |
| Invalid profile or contact fields | 400 | `VALIDATION_ERROR` |
| Duplicate phone number | 409 | `ACCOUNT_ALREADY_EXISTS` |
| Contact does not exist or is not accessible | 404 | `NOT_FOUND` |
| Unexpected database or server failure | 500 | `INTERNAL_SERVER_ERROR` |

Validation failures must identify the relevant field without exposing internal database errors or sensitive information.

### 4.5 Data Integrity Requirements

Patient profile and emergency contact operations must preserve data integrity.

The backend must:

- Use database transactions for operations involving multiple related changes.
- Enforce ownership through database queries and authorization checks.
- Generate identifiers and timestamps on the server.
- Prevent duplicate primary emergency contacts.
- Avoid cascading deletion of historical emergency records.
- Preserve audit records for security-sensitive changes.
- Avoid exposing database implementation details in API responses.

## 5. Emergency Request APIs

Emergency Request APIs allow authenticated patients to create and manage transportation emergency requests.

These endpoints are central to AIDORA's emergency coordination workflow. The backend must prioritize patient safety, reliable dispatch, accurate location handling, data integrity, and auditable state transitions.

All endpoints in this section require a valid patient access token unless explicitly stated otherwise.

The authenticated patient identity must always be derived from the validated access token. The backend must never trust a client-supplied patient ID as proof of ownership.

### 5.1 Create Emergency Request

`POST /api/v1/emergencies`

Creates a new emergency request for the authenticated patient and initiates the dispatch process.

**Authorization:** Authenticated patient.

**Request headers:**

`Authorization: Bearer <access_token>`

`Idempotency-Key: <unique-client-generated-key>`

The idempotency key prevents accidental duplicate emergency requests caused by repeated submissions, mobile network interruptions, or client retries.

The backend must retain the result associated with an idempotency key for the agreed retention period. Repeating the same request with the same key must not create another emergency.

Reusing the same key with a materially different request payload must be rejected.

**Request body:**

```json
{
  "location": {
    "source": "GPS",
    "latitude": 7.7322,
    "longitude": 8.5391,
    "accuracyMeters": 12.5,
    "accuracyLevel": "HIGH",
    "villageCommunity": "Example Community",
    "landmark": "Near the community market",
    "streetAddress": "Example Street",
    "directionsNotes": "Use the road beside the market"
  },
  "notes": "Transportation assistance required"
}
```

The `location` object must support the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | Yes | `GPS` or `MANUAL`. |
| `latitude` | number | Conditional | Latitude supplied by GPS when available. |
| `longitude` | number | Conditional | Longitude supplied by GPS when available. |
| `accuracyMeters` | number | Conditional | GPS accuracy in metres. |
| `accuracyLevel` | string | Conditional | `HIGH`, `MEDIUM`, `LOW`, or `APPROXIMATE`. |
| `villageCommunity` | string | Recommended | Community or village where pickup is required. |
| `landmark` | string | Recommended | Nearby identifiable landmark. |
| `streetAddress` | string | Optional | Street or physical address. |
| `directionsNotes` | string | Optional | Additional pickup directions. |
| `notes` | string | Optional | Patient-provided transportation-related information. |

The top-level `notes` field is optional and must not be treated as a substitute for structured location information.

#### 5.1.1 GPS Location Validation

When `source` is `GPS`:

- Both latitude and longitude must be supplied.
- Latitude must be between -90 and 90.
- Longitude must be between -180 and 180.
- GPS accuracy must be validated when supplied.
- The backend must preserve the reported accuracy information.
- The backend must not silently replace inaccurate coordinates with guessed coordinates.

The backend should store valid GPS coordinates using the existing PostGIS geographic location model.

#### 5.1.2 Manual Location Validation

When `source` is `MANUAL`:

- Latitude and longitude must be omitted or explicitly null.
- The backend must not generate coordinates from a village name, landmark, or address without an explicitly authorised geocoding operation.
- The location must retain its manual source designation.
- The backend should require sufficient descriptive information to help a responder identify the pickup location.

**Critical safety invariant:** A manually entered location must never be represented as a verified GPS location.

If coordinates are unavailable, the backend must preserve that absence rather than fabricate a location.

#### 5.1.3 Emergency Creation Processing

After successful validation, the backend must:

1. Identify the patient from the authenticated principal.
2. Check whether the patient already has an active emergency.
3. Validate the supplied pickup location.
4. Create the emergency record.
5. Record the initial `CREATED` state.
6. Initiate dispatch and record the transition to `DISPATCHING`.
7. Create the associated emergency history records.
8. Commit the emergency and its initial history atomically.

The backend must prevent a patient from creating multiple conflicting active emergencies.

An active emergency check must be protected against concurrent requests so that two simultaneous submissions cannot create duplicate active emergencies.

**Success response:** HTTP `202 Accepted`.

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "DISPATCHING",
    "location": {
      "source": "GPS",
      "latitude": 7.7322,
      "longitude": 8.5391,
      "accuracyMeters": 12.5,
      "accuracyLevel": "HIGH",
      "villageCommunity": "Example Community",
      "landmark": "Near the community market"
    },
    "createdAt": "2026-11-12T10:00:00Z",
    "updatedAt": "2026-11-12T10:00:00Z"
  }
}
```

The backend must not report successful responder assignment until a responder has actually accepted and been assigned.

### 5.2 Retrieve Active Emergency

`GET /api/v1/emergencies/active`

Retrieves the authenticated patient's current active emergency.

**Authorization:** Authenticated patient.

**Success response:** HTTP `200 OK`.

When the patient has an active emergency:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ACCEPTED",
    "createdAt": "2026-11-12T10:00:00Z",
    "updatedAt": "2026-11-12T10:05:00Z",
    "assignedResponder": {
      "id": "750e8400-e29b-41d4-a716-446655440000",
      "fullName": "John Responder",
      "phoneNumber": "+2348012345678",
      "roleDescription": "Transportation responder",
      "vehicleType": "MOTORCYCLE",
      "vehicleModel": "Example Motorcycle",
      "licensePlate": "ABC-123-XY",
      "rating": 4.8,
      "etaMinutes": 12
    }
  }
}
```

When no active emergency exists:

```json
{
  "success": true,
  "data": null
}
```

The responder object must be omitted or null until an authorised responder has been assigned.

Responder information must be limited to information necessary for transportation coordination.

The endpoint must not expose responder verification documents, private account information, or unrelated personal data.

The backend must return the latest authoritative emergency state, not a potentially stale state maintained by the frontend.

### 5.3 Cancel Emergency

`POST /api/v1/emergencies/{id}/cancel`

Allows the authenticated patient to cancel their own emergency request before patient boarding.

**Authorization:** Authenticated patient who owns the emergency.

**Request body:**

```json
{
  "reason": "Transportation is no longer required"
}
```

The reason is optional but should be recorded when supplied.

Cancellation is permitted only in the following states:

- `CREATED`
- `DISPATCHING`
- `EXPIRED`
- `ESCALATED`
- `ACCEPTED`
- `PICKUP_ARRIVED`
- `REASSIGNING`
- `FAILED_CONTACT`

Cancellation is prohibited from `PATIENT_ONBOARD` onward.

The backend must enforce the state machine's permitted cancellation
transitions and verify that the authenticated patient owns the emergency.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "CANCELLED",
    "cancelledAt": "2026-11-12T10:10:00Z"
  }
}
```

The backend must:

- Verify emergency ownership.
- Check the current emergency state inside a transaction.
- Enforce the cancellation allowlist.
- Record the actor and cancellation timestamp.
- Preserve the complete emergency history.
- Invalidate outstanding offers associated with the emergency.
- Release any applicable pre-boarding responder assignment.
- Notify relevant participants of the cancellation.

Concurrent cancellation and boarding operations must not produce an inconsistent state. The backend must serialize or otherwise safely coordinate these transitions.

If cancellation is not permitted, return HTTP `409 Conflict` with error code `CANCELLATION_FORBIDDEN`.

### 5.4 Dismiss Emergency

`POST /api/v1/emergencies/{id}/dismiss`

Allows the authenticated patient to acknowledge the conclusion of an emergency and dismiss it from the active client-facing session.

**Authorization:** Authenticated patient who owns the emergency.

**Request body:**

```json
{
  "acknowledged": true
}
```

The backend must permit dismissal only when the emergency has reached an eligible concluded state, such as:

- `COMPLETED`
- `CANCELLED`
- `EXPIRED`, only when no unresolved escalation or operational intervention remains.

An emergency in `ESCALATED` or another unresolved operational state must not be dismissed merely to hide an active incident.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "dismissed": true,
    "dismissedAt": "2026-11-12T10:30:00Z"
  }
}
```

Dismissal is an acknowledgement operation, not a lifecycle state transition.

The backend must not:

- Delete the emergency record.
- Delete emergency history.
- Change `COMPLETED` to another state.
- Remove audit records.
- Treat dismissal as permission to bypass unresolved dispatch or handover operations.

Repeated dismissal requests must be handled idempotently.

### 5.5 Emergency History

`GET /api/v1/emergencies/history`

Retrieves the authenticated patient's previous emergency requests.

**Authorization:** Authenticated patient.

The history endpoint must return only records belonging to the authenticated patient.

The default history includes concluded emergencies, including:

- `COMPLETED`
- `CANCELLED`
- `EXPIRED`, where no unresolved escalation or operational intervention remains.

An emergency that is still being handled by human dispatch must not be presented as a concluded historical record.

#### 5.5.1 Pagination

The endpoint must support pagination.

Example:

`GET /api/v1/emergencies/history?page=1&limit=20`

Parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number, starting at 1. |
| `limit` | integer | 20 | Number of records per page. |

The backend must enforce a maximum page size to prevent excessive database queries and responses.

#### 5.5.2 Success Response

HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "COMPLETED",
        "createdAt": "2026-11-12T10:00:00Z",
        "completedAt": "2026-11-12T10:45:00Z",
        "facility": {
          "id": "850e8400-e29b-41d4-a716-446655440000",
          "name": "Example Healthcare Facility"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

The backend must return an empty `items` array when no historical records exist.

History records must be ordered by creation time, newest first, with a deterministic secondary ordering where timestamps are equal.

The response must not expose unnecessary sensitive patient information or internal dispatch data.

### 5.6 Emergency State and History Integrity

All emergency operations must respect the state machine defined in Section 2.

The backend must:

- Enforce permitted state transitions.
- Record every successful transition in emergency history.
- Generate timestamps on the server.
- Preserve responder assignment and operational history.
- Prevent unauthorized changes to emergency ownership.
- Prevent duplicate emergency creation through idempotency handling.
- Use database transactions for state changes and associated history records.
- Preserve historical records when an emergency is cancelled, completed, or dismissed.

The client must retrieve the latest emergency state from the backend after reconnection or recovery from network interruption.

### 5.7 Emergency API Error Responses

All emergency endpoints must use the standard error envelope defined in Section 1.

| Condition | HTTP status | Error code |
|---|---:|---|
| Missing or invalid authentication | 401 | `UNAUTHENTICATED` |
| Patient does not own the emergency | 404 | `NOT_FOUND` |
| Emergency does not exist | 404 | `NOT_FOUND` |
| Invalid request fields | 400 | `VALIDATION_ERROR` |
| Missing or invalid location | 400 | `MISSING_LOCATION` |
| Invalid phone number, where applicable | 400 | `INVALID_PHONE` |
| Patient already has an active emergency | 409 | `ACTIVE_EMERGENCY_EXISTS` |
| Cancellation not permitted | 409 | `CANCELLATION_FORBIDDEN` |
| Invalid emergency state transition | 409 | `INVALID_STATE_TRANSITION` |
| Idempotency key reused with a different payload | 409 | `IDEMPOTENCY_KEY_CONFLICT` |
| Dispatch service unavailable | 503 | `DISPATCH_UNAVAILABLE` |
| Unexpected server failure | 500 | `INTERNAL_SERVER_ERROR` |

The backend must not expose database errors, stack traces, access tokens, or other internal implementation details in API responses.

## 6. Responder APIs

Responder APIs allow registered and authorised transportation responders to manage their availability, receive emergency offers, accept or decline assignments, update journey milestones, and record operational handovers.

AIDORA responders provide transportation services only. They are not healthcare professionals acting on behalf of the platform and must not perform clinical assessment, diagnosis, or treatment.

All endpoints in this section require a valid responder access token unless explicitly stated otherwise.

The backend is authoritative for responder verification, eligibility, availability, dispatch assignment, offer expiration, and journey state transitions.

### 6.1 Responder Registration and Authentication

Responder registration and login endpoints are defined in Section 3.

The backend must maintain a responder profile associated with the authenticated user account.

The responder profile must include the relevant transportation and verification information, including:

- Full name.
- Phone number.
- Vehicle type.
- Vehicle make and model.
- Vehicle registration number.
- Vehicle colour.
- Driver's licence reference.
- Community or operating base.
- Verification status.
- Availability status.
- Completed journey statistics.

The backend must protect responder identity and verification documents from unauthorised access.

### 6.2 Responder Verification

The canonical backend verification states are:

PENDING

VERIFIED

UNVERIFIED

SUSPENDED

Status

Meaning

Dispatch eligibility

PENDING

Registration submitted and awaiting verification.

Not eligible

VERIFIED

Required verification successfully completed.

Eligible, subject to other checks

UNVERIFIED

Verification is incomplete or unsuccessful.

Not eligible

SUSPENDED

Responder participation has been suspended.

Not eligible

Only VERIFIED responders may become ONLINE or receive and accept dispatch offers.

Verification status must be controlled by authorised administrative operations. Responders must not modify their own verification status.

### 6.3 Responder Availability

#### 6.3.1 Update Availability

`POST /api/v1/responder/availability`

Allows an authenticated responder to change their availability status.

**Authorization:** Authenticated responder.

**Request body:**

```json
{
  "status": "ONLINE"
}
```

Supported values:

- `ONLINE`
- `OFFLINE`

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "status": "ONLINE",
    "updatedAt": "2026-11-12T10:00:00Z"
  }
}
```

The backend must enforce the following rules:

1. Only `VERIFIED` responders may go `ONLINE`.
2. A responder with an active journey must not become available for another assignment.
3. A responder who is not eligible for dispatch must not receive new offers.
4. Availability changes must be recorded using server-generated timestamps.
5. A responder must not be marked `ONLINE` merely because their application reconnects.
6. Temporary network disconnection must not automatically be treated as an explicit request to go `OFFLINE`.

If verification is incomplete or the responder is suspended, attempting to go online must return HTTP `403 Forbidden` with error code `VERIFICATION_REQUIRED` or the applicable authorization error.

#### 6.3.2 Retrieve Availability

`GET /api/v1/responder/availability`

Retrieves the authenticated responder's current availability and verification status.

**Authorization:** Authenticated responder.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "verificationStatus": "VERIFIED",
    "availabilityStatus": "ONLINE",
    "hasActiveJourney": false,
    "updatedAt": "2026-11-12T10:00:00Z"
  }
}
```

The backend must return its current authoritative values rather than relying on locally cached frontend status.

### 6.4 Active Dispatch Offers

The backend must enforce a 30-second responder offer timeout.

Each offer must include a server-generated expiresAt timestamp representing its authoritative expiration time.

The backend must:

Expire an offer when its 30-second acceptance period ends.

Reject acceptance attempts after expiration.

Prevent expired offers from being accepted through delayed or repeated client requests.

Ensure only one responder can accept an emergency.

Record offer creation, expiration, acceptance, or decline timestamps.

The frontend countdown is informational only. The backend remains authoritative for offer validity.

#### 6.4.1 Retrieve Active Offer

`GET /api/v1/responder/offers/active`

Retrieves the authenticated responder's current pending emergency offer.

**Authorization:** Authenticated, eligible responder.

**Success response:** HTTP `200 OK`.

When an active offer exists:

```json
{
  "success": true,
  "data": {
    "offerId": "950e8400-e29b-41d4-a716-446655440000",
    "emergencyId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-11-12T10:00:45Z",
    "pickupLocation": {
      "source": "GPS",
      "latitude": 7.7322,
      "longitude": 8.5391,
      "accuracyMeters": 12.5,
      "villageCommunity": "Example Community",
      "landmark": "Near the community market",
      "streetAddress": "Example Street",
      "directionsNotes": "Use the road beside the market"
    },
    "estimatedDistanceKm": 4.5,
    "designatedFacility": {
      "id": "850e8400-e29b-41d4-a716-446655440000",
      "name": "Example Healthcare Facility",
      "address": "Example Facility Address"
    }
  }
}
```

When no active offer exists:

```json
{
  "success": true,
  "data": null
}
```

The backend must:

- Return only offers assigned to the authenticated responder.
- Exclude expired, withdrawn, or already accepted offers.
- Enforce responder verification and availability eligibility.
- Prevent responders with active journeys from receiving another offer.
- Include a server-generated expiration timestamp.
- Avoid exposing unnecessary patient information.

Patient names, phone numbers, pregnancy information, blood groups, allergies, and private patient notes must not be included in ordinary dispatch offers.

The responder must receive only the information necessary to locate the pickup point and coordinate transportation.

The frontend countdown is informational. The backend determines whether an offer is still valid.

### 6.5 Accept Emergency Offer

`POST /api/v1/responder/offers/{offerId}/accept`

Allows an eligible responder to accept an assigned emergency offer.

**Authorization:** Authenticated and verified responder.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "emergencyId": "550e8400-e29b-41d4-a716-446655440000",
    "offerId": "950e8400-e29b-41d4-a716-446655440000",
    "status": "ACCEPTED",
    "acceptedAt": "2026-11-12T10:00:30Z"
  }
}
```

The backend must verify that:

- The offer exists.
- The offer belongs to the authenticated responder.
- The offer has not expired.
- The emergency has not been assigned to another responder.
- The responder remains `VERIFIED`.
- The responder is eligible and has no conflicting active journey.
- The emergency is still in an appropriate dispatch state.

Offer acceptance and emergency assignment must occur atomically.

Concurrent acceptance requests must not allow multiple responders to become assigned to the same emergency.

The backend must record:

- The accepted offer.
- The assigned responder.
- The acceptance timestamp.
- The emergency state transition to `ACCEPTED`.
- The corresponding emergency history record.

If the offer has expired, return HTTP `409 Conflict` with error code `OFFER_EXPIRED`.

If another responder has already accepted the emergency, return HTTP `409 Conflict` with error code `OFFER_UNAVAILABLE`.

If the responder already has an active journey, return HTTP `409 Conflict` with error code `ACTIVE_JOURNEY_EXISTS`.

### 6.6 Decline Emergency Offer

`POST /api/v1/responder/offers/{offerId}/decline`

Allows a responder to decline an assigned emergency offer.

**Authorization:** Authenticated responder who owns the offer.

**Request body:**

```json
{
  "reason": "UNAVAILABLE"
}
```

The reason is optional.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "offerId": "950e8400-e29b-41d4-a716-446655440000",
    "status": "DECLINED",
    "declinedAt": "2026-11-12T10:00:20Z"
  }
}
```

The backend must:

- Confirm offer ownership.
- Confirm that the offer is still eligible for a decline operation.
- Record the decline and its timestamp.
- Prevent the declined offer from being accepted later.
- Update dispatch eligibility according to the responder's current journey and availability.
- Continue dispatch processing according to the configured dispatch policy.

Declining an offer must not automatically force a responder with an active journey to become available.

The backend must not assume that the responder should always return to `ONLINE`. The resulting availability must reflect the responder's actual eligibility and current status.

### 6.7 Active Responder Journey

`GET /api/v1/responder/journey/active`

Retrieves the authenticated responder's current active emergency journey.

**Authorization:** Authenticated responder.

**Success response:** HTTP `200 OK`.

When an active journey exists:

```json
{
  "success": true,
  "data": {
    "emergencyId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ACCEPTED",
    "assignedAt": "2026-11-12T10:00:30Z",
    "pickupLocation": {
      "source": "GPS",
      "latitude": 7.7322,
      "longitude": 8.5391,
      "villageCommunity": "Example Community",
      "landmark": "Near the community market"
    },
    "facility": {
      "id": "850e8400-e29b-41d4-a716-446655440000",
      "name": "Example Healthcare Facility",
      "address": "Example Facility Address"
    }
  }
}
```

When no active journey exists:

```json
{
  "success": true,
  "data": null
}
```

The endpoint must return only journeys assigned to the authenticated responder.

It must not expose unnecessary patient medical information or private patient profile fields.

### 6.8 Journey Milestone Updates

`POST /api/v1/responder/journey/{emergencyId}/milestone`

Allows the assigned responder to report an authorised journey milestone.

**Authorization:** Authenticated responder assigned to the emergency.

**Request body:**

```json
{
  "status": "PICKUP_ARRIVED"
}
```

Supported milestone values:

- `PICKUP_ARRIVED`
- `PATIENT_ONBOARD`
- `IN_TRANSIT`
- `ARRIVED`

`HOSPITAL_SELECTED` is managed through the separately authorised facility-selection operation. It must not be treated as an ordinary responder milestone until the responsible actor and operation have been formally agreed.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "emergencyId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PICKUP_ARRIVED",
    "updatedAt": "2026-11-12T10:10:00Z"
  }
}
```

The backend must enforce strict sequential progression.

The expected milestone sequence is:

`ACCEPTED → PICKUP_ARRIVED → PATIENT_ONBOARD → IN_TRANSIT → ARRIVED`

Where `HOSPITAL_SELECTED` is used as an explicit state, it must be inserted according to the state machine and facility-selection rules defined in Section 2.

The backend must:

- Confirm that the responder is assigned to the emergency.
- Validate the current emergency state.
- Reject skipped or invalid milestones.
- Record each successful transition.
- Generate timestamps on the server.
- Prevent duplicate or conflicting concurrent transitions.
- Preserve the original responder assignment.

A responder must not directly mark an emergency `COMPLETED`. Completion is handled through the operational handover endpoint.

Invalid transitions must return HTTP `409 Conflict` with error code `INVALID_STATE_TRANSITION`.

### 6.9 Patient Boarding and Operational Incident Handling

Once the responder reports `PATIENT_ONBOARD`, the backend must enforce the post-boarding safety rule defined in Section 2.

Automatic responder reassignment is prohibited from this point onward.

If the responder becomes unable to continue after boarding:

1. Preserve the assigned responder and original journey.
2. Record the operational incident and timestamp.
3. Escalate the emergency for human dispatch intervention.
4. Allow an authorised dispatcher to coordinate safe alternative transport.
5. Preserve the original assignment, milestones, and incident history.

A responder must not be able to resolve such an incident by simply declining the journey or triggering ordinary automated reassignment.

### 6.10 Operational Facility Handover

POST /api/v1/responder/journey/{emergencyId}/handover

Records the explicit operational handover of the patient at the receiving healthcare facility.

Authorization: Authenticated responder assigned to the emergency.

Request body:

{
  "facilityId": "850e8400-e29b-41d4-a716-446655440000",
  "handoverNotes": "Patient transported to the designated receiving facility."
}

The backend must record an immutable handover record containing:

Emergency ID.

Receiving facility ID.

Assigned responder ID.

Server-generated handover timestamp.

Operational handover status.

Optional transportation-related handover notes.

Receiving-facility acknowledgement details when available.

Receiving-facility acknowledgement is not mandatory for emergency completion. Where acknowledgement is available, the backend must record the acknowledging user's identity and acknowledgement timestamp.

The backend must:

Confirm that the responder is assigned to the emergency.

Confirm that the emergency is currently ARRIVED.

Validate the receiving facility.

Confirm that the facility is the designated facility or that an authorised facility change has been recorded.

Record the operational handover.

Generate the handover timestamp on the server.

Record receiving-facility acknowledgement when available.

Transition the emergency to COMPLETED.

Record the corresponding emergency history entry.

Update responder journey statistics exactly once.

The handover record, emergency completion, history entry, and statistics update must be committed atomically.

ARRIVED must never automatically become COMPLETED.

A responder must not be allowed to complete a journey before recording the operational handover.

Handover notes must contain transportation and operational information only. Clinical assessments, diagnoses, treatment instructions, and unnecessary pregnancy-related details must not be collected through this endpoint.

`POST /api/v1/responder/journey/{emergencyId}/handover`

Records the operational handover of the patient at the receiving healthcare facility.

**Authorization:** Authenticated responder assigned to the emergency, subject to the final facility handover authorization policy.

**Request body:**

```json
{
  "facilityId": "850e8400-e29b-41d4-a716-446655440000",
  "handoverNotes": "Patient transported to the designated receiving facility."
}
```

The exact required fields and whether receiving facility staff must authenticate or acknowledge the handover remain subject to joint agreement.

The minimum proposed handover information is:

- Emergency ID.
- Receiving facility ID.
- Assigned responder ID.
- Server-generated handover timestamp.
- Operational handover status.
- Optional transportation-related handover notes.
- Receiving facility acknowledgement, if required by the final policy.

**Success response:** HTTP `200 OK`.

```json
{
  "success": true,
  "data": {
    "emergencyId": "550e8400-e29b-41d4-a716-446655440000",
    "facilityId": "850e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED",
    "handedOverAt": "2026-11-12T10:45:00Z"
  }
}
```

The backend must:

1. Confirm that the responder is assigned to the emergency.
2. Confirm that the emergency is currently `ARRIVED`.
3. Validate the receiving facility.
4. Confirm that the facility is the designated facility or that an authorised facility change has been recorded.
5. Record the operational handover.
6. Record the server-generated handover timestamp.
7. Transition the emergency to `COMPLETED`.
8. Record the corresponding emergency history entry.
9. Update responder journey statistics.
10. Preserve the complete emergency and handover history.

The handover record and transition to `COMPLETED` must be committed atomically.

`ARRIVED` must never automatically become `COMPLETED`.

A responder must not be allowed to complete a journey before arrival and operational handover.

Handover notes must be limited to transportation and operational information. Clinical assessments, diagnoses, treatment instructions, and unnecessary pregnancy-related details must not be collected through this endpoint.

### 6.11 Responder Statistics

The backend must maintain accurate responder journey statistics.

At minimum, the system should track:

- Total completed journeys.
- Relevant journey completion timestamps.
- Current availability.
- Current verification status.

A completed journey must increment the responder's completed-trip count exactly once.

Repeated handover requests or retries must not increment statistics more than once.

Cancelled, expired, or unsuccessful journeys must not be counted as completed trips.

The backend must derive statistics from authoritative journey records or maintain them transactionally with those records.

### 6.12 Responder Location Updates

Responder location updates may be used to support patient journey tracking.

Location updates must:

- Be associated with the authenticated responder.
- Be accepted only for an authorised active journey.
- Include valid latitude and longitude.
- Include a server-generated receipt timestamp.
- Preserve the distinction between location observation time and server receipt time where both are supplied.
- Avoid publishing stale or invalid coordinates as current location.
- Be shared only with authorised participants in the relevant emergency.

The responder must not be able to submit location updates for another responder's journey.

The real-time delivery format and update frequency are defined in Section 8.

### 6.13 Responder API Error Responses

All responder endpoints must use the standard error envelope defined in Section 1.

| Condition | HTTP status | Error code |
|---|---:|---|
| Missing or invalid authentication | 401 | `UNAUTHENTICATED` |
| Authenticated user lacks responder permission | 403 | `FORBIDDEN` |
| Verification required | 403 | `VERIFICATION_REQUIRED` |
| Responder does not own the offer or journey | 404 | `NOT_FOUND` |
| Offer has expired | 409 | `OFFER_EXPIRED` |
| Offer is no longer available | 409 | `OFFER_UNAVAILABLE` |
| Responder already has an active journey | 409 | `ACTIVE_JOURNEY_EXISTS` |
| Invalid journey milestone | 409 | `INVALID_STATE_TRANSITION` |
| Invalid or incomplete request data | 400 | `VALIDATION_ERROR` |
| Facility or handover validation failure | 400 | `VALIDATION_ERROR` |
| Unexpected server failure | 500 | `INTERNAL_SERVER_ERROR` |

The backend must not expose internal database errors, private patient information, or authentication secrets in error responses.

### 6.14 Responder Data Integrity and Safety Requirements

The backend must enforce the following requirements across all responder operations:

- A responder must be verified before becoming eligible for dispatch.
- A responder must not accept multiple conflicting active journeys.
- Offer acceptance and emergency assignment must be atomic.
- Offer expiration must be decided by the backend.
- Journey milestones must follow the canonical state machine.
- Only the assigned responder may perform ordinary journey updates.
- A responder must not directly mark an emergency completed.
- Operational handover must be recorded before completion.
- Automatic reassignment must never occur after `PATIENT_ONBOARD`.
- Post-boarding incidents must preserve the original assignment and be escalated for human intervention.
- Patient medical and pregnancy information must not be unnecessarily exposed to responders.
- All significant responder actions must be auditable.

# Section 7 — Healthcare Facility APIs

## 7.1 Purpose and Scope

The Healthcare Facility APIs allow authorised clients to discover healthcare facilities, inspect facility information, and view the operational capabilities and status relevant to emergency transportation.

The backend is responsible for:
- Returning accurate facility information.
- Supporting proximity-based facility discovery using PostgreSQL and PostGIS.
- Filtering facilities by type, operational status, and available capabilities.
- Excluding facilities that are not eligible for ordinary emergency destination selection.
- Protecting facility information from unauthorised modification.
- Maintaining accurate, auditable facility records.

Facility discovery does not, by itself, authorise a facility to become the receiving destination for an active emergency.

**Important distinction:** The initial receiving-facility selection actor and operation have not yet been approved. This section therefore defines discovery and detail retrieval, but does not authorise the patient, responder, dispatcher, or automated system to select a facility. That decision must be agreed before implementing the facility-selection operation.

## 7.2 Facility Discovery

### Endpoint

`GET /api/v1/facilities`

### Purpose

Returns a paginated list of healthcare facilities matching the supplied search criteria.

### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `latitude` | number | No | Latitude of the search reference point |
| `longitude` | number | No | Longitude of the search reference point |
| `radiusKm` | number | No | Maximum search radius in kilometres |
| `facilityType` | string | No | Filter by facility type |
| `capability` | string | No | Filter by a facility capability |
| `status` | string | No | Filter by operational status |
| `city` | string | No | Filter by city |
| `state` | string | No | Filter by state |
| `page` | integer | No | Page number; defaults to 1 |
| `limit` | integer | No | Page size; defaults to 20 |

Supported facility types:

- `PUBLIC`
- `PRIVATE`
- `MISSION`
- `OTHER`

Supported operational statuses:

- `ACTIVE`
- `TEMPORARILY_CLOSED`
- `INACTIVE`

### Location Search Rules

- `latitude` and `longitude` must be supplied together.
- Coordinates must be within valid geographic ranges.
- `radiusKm` requires valid coordinates and must be a positive value within the backend-configured maximum.
- Proximity calculations must use PostGIS geographic distance calculations in metres.
- The backend must not calculate real-world distances using ordinary latitude/longitude arithmetic.
- When coordinates are supplied, results may be ordered by increasing distance.
- The response should include the calculated distance when a valid search reference point is supplied.
- When coordinates are unavailable, facilities may still be searched using supported non-location filters, but the backend must not claim that the results are geographically nearest.

If the patient's location was entered manually without geographic coordinates, the backend must not fabricate coordinates or present a proximity ranking as though the location had been verified.

### Discovery Eligibility Rules

- Ordinary discovery results should prioritise facilities with `ACTIVE` status.
- `TEMPORARILY_CLOSED` and `INACTIVE` facilities must not be treated as eligible emergency destinations for ordinary dispatch.
- A facility's active status alone does not guarantee that it can receive a particular emergency.
- Capability availability and any additional operational eligibility checks must be considered before a facility is used as a receiving destination.
- The backend must not assume that a facility has a capability simply because its name or facility type suggests it.

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "facilities": [
      {
        "id": "uuid",
        "name": "Example Healthcare Facility",
        "facilityType": "PUBLIC",
        "phoneNumber": "+2348000000000",
        "email": "contact@example.com",
        "address": "Example Street",
        "city": "Makurdi",
        "state": "Benue",
        "country": "Nigeria",
        "status": "ACTIVE",
        "capabilities": [
          {
            "name": "MATERNAL_EMERGENCY",
            "isAvailable": true
          }
        ],
        "distanceMeters": 2500
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

`distanceMeters` is included only when a valid geographic reference point was supplied and a distance could be calculated. It must not be populated with an invented or estimated value.

The example capability is illustrative. The final canonical capability vocabulary must be agreed by the frontend and backend teams before implementation.

## 7.3 Facility Detail

### Endpoint

`GET /api/v1/facilities/{facilityId}`

### Purpose

Returns the detailed information for one healthcare facility.

### Path Parameter

| Parameter | Type | Required | Description |
|---|---|---|---|
| `facilityId` | UUID | Yes | Unique facility identifier |

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "facility": {
      "id": "uuid",
      "name": "Example Healthcare Facility",
      "facilityType": "PUBLIC",
      "phoneNumber": "+2348000000000",
      "email": "contact@example.com",
      "address": "Example Street",
      "city": "Makurdi",
      "state": "Benue",
      "country": "Nigeria",
      "status": "ACTIVE",
      "capabilities": [
        {
          "name": "MATERNAL_EMERGENCY",
          "isAvailable": true
        }
      ],
      "createdAt": "2026-11-12T10:00:00Z",
      "updatedAt": "2026-11-12T10:00:00Z"
    }
  }
}
```

### Access and Data Rules

- Facility identifiers must be valid UUIDs.
- The backend must return `NOT_FOUND` when the facility does not exist.
- Only information approved for the requesting user's role should be exposed.
- The endpoint must not expose internal administrative information, private credentials, or unrelated patient information.
- Facility operational status and capabilities must reflect the latest persisted backend records.

## 7.4 Facility Capabilities and Availability

Facility capabilities describe services or resources a facility reports as available.

Each capability must have:
- A capability name.
- An availability flag.
- A creation timestamp.
- An update timestamp.

The backend must distinguish between:
- A facility having a capability recorded.
- A facility reporting that capability as currently available.
- A facility being operationally eligible to receive a particular emergency.

These are not interchangeable.

A capability marked unavailable must not be presented as currently available.

The backend must not interpret missing capability information as confirmation that a capability exists.

**Capability vocabulary:** The database currently supports capability names as strings rather than a fixed database enum. The frontend and backend teams must agree on canonical capability names and their meanings before implementation. New capability values must not be invented independently by either team.

## 7.5 Facility Selection for an Active Emergency

The initial selection of a receiving facility is a separate operation from facility discovery.

The following rules apply:

1. A facility returned by the discovery endpoint is not automatically selected for an emergency.
2. The receiving facility must be established before the emergency enters `IN_TRANSIT`.
3. The optional `HOSPITAL_SELECTED` state may represent the selection stage.
4. The backend must validate the selected facility's existence, operational status, and relevant eligibility before accepting a selection.
5. The backend must record the selected facility, the authorised actor, and the server-generated timestamp.
6. The backend must reject unauthorised facility-selection attempts.
7. Facility selection and the corresponding emergency state update must be handled consistently to prevent conflicting records.

**Pending approval — authorised selection actor and endpoint**

The following decisions remain unresolved and must be agreed before implementation:

- Whether the patient, assigned responder, authorised dispatcher, or automated dispatch service may select the receiving facility.
- Whether more than one actor may select or change the facility.
- The exact API endpoint and request body.
- Whether changing an already selected facility requires a specific state, authorisation, or audit reason.

No facility-selection endpoint or actor permission should be treated as final until these decisions are approved.

## 7.6 Relationship to Facility Handover

Facility selection and operational handover are different operations.

- Facility selection establishes the intended receiving destination before transportation begins.
- Facility handover records the actual receiving facility when the responder completes the operational handover.

The agreed handover rules remain:

- Only the assigned responder records the operational handover.
- The responder explicitly records the receiving facility.
- The backend generates the authoritative handover timestamp.
- The handover record is immutable.
- Receiving-facility acknowledgement may be recorded when available, but is not mandatory for completion.
- The backend transitions the emergency from `ARRIVED` to `COMPLETED` after the required responder handover has been successfully recorded.
- Facility staff authentication or acknowledgement must not be made a mandatory completion requirement.
- Handover notes must contain operational or transportation information only, not clinical triage notes.

The handover operation must validate that the recorded facility is valid and that the emergency is in the correct state.

## 7.7 Error Responses

| Error Code | HTTP Status | Meaning |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Authentication is missing or invalid |
| `FORBIDDEN` | 403 | User is not authorised to access the requested resource |
| `NOT_FOUND` | 404 | Facility does not exist |
| `VALIDATION_ERROR` | 422 | Invalid query parameters or facility identifier |
| `INVALID_STATE_TRANSITION` | 409 | Requested facility operation conflicts with the emergency state |
| `FACILITY_UNAVAILABLE` | 409 | Facility is not eligible for the requested operation |

All errors must use the standard API error envelope defined in Section 1.

## 7.8 Database and PostGIS Requirements

The facility APIs must use the existing `facilities` and `facility_capabilities` database tables.

The implementation must preserve these requirements:

- Facility primary keys remain UUIDs.
- Geographic locations use `GEOGRAPHY(POINT, 4326)`.
- The existing GIST index must support geographic proximity searches.
- Distance calculations must use geography-based PostGIS functions such as `ST_DWithin` and `ST_Distance`.
- `ST_MakePoint` must receive longitude first and latitude second.
- Facility capability queries must use the existing facility-to-capability relationship.
- Facility status and capability filters must be applied by the backend, not trusted solely to frontend filtering.

Facility discovery must not create, modify, or delete facility records.

Facility creation, administrative updates, capability management, and operational status changes require separately authorised administrative operations. Their endpoints and permissions will be defined in a later administrative API section.

## 7.9 Audit and Integrity Requirements

The backend must preserve an auditable record of facility information changes and any facility-related action associated with an emergency.

At minimum:
- Facility creation and updates must have server-generated timestamps.
- Facility status changes must be traceable to an authorised actor.
- Capability availability changes must be traceable.
- Facility selection must record the authorised actor and timestamp once its selection contract is approved.
- Actual receiving-facility handover must be recorded independently of the originally selected facility.
- Historical emergency and handover records must not be silently overwritten when facility information changes.

Facility records referenced by historical emergencies must not be deleted in a way that destroys emergency history.

## 7.10 Implementation Boundary

The following are within the scope of this section:

- Facility discovery.
- Facility detail retrieval.
- Geographic proximity search.
- Facility type, status, and capability filtering.
- Facility eligibility checks as defined by approved business rules.
- Integration with the existing facility database schema.

The following remain pending separate approval or specification:

- Initial receiving-facility selection actor and endpoint.
- Canonical facility capability vocabulary.
- Facility administrative creation and update APIs.
- Facility operational availability update permissions.
- Any future facility acknowledgement workflow.

**Implementation must not begin by assuming these unresolved decisions.** The backend should implement only the approved discovery and detail operations until the remaining contracts are agreed.

# Section 8 — Dispatch and Responder Offer APIs

## 8.1 Purpose and Scope

The Dispatch and Responder Offer APIs coordinate the assignment of verified responders to patient emergency requests.

The backend dispatch engine is responsible for:

- Identifying eligible responders.
- Creating and delivering responder offers.
- Enforcing the 30-second offer timeout.
- Processing responder acceptance and decline.
- Preventing duplicate assignments.
- Managing offer expiration and dispatch retries.
- Preserving responder assignment and emergency history.
- Escalating unresolved dispatch situations to authorised human dispatch intervention.

Dispatch decisions must be authoritative on the backend. The frontend displays dispatch status and responds to backend events; it must not independently decide that a responder has been assigned, an offer has expired, or an emergency has been reassigned.

## 8.2 Dispatch Eligibility Rules

Before creating an offer, the backend must validate responder eligibility.

A responder is eligible for an ordinary dispatch offer only when:

1. The responder has a valid account.
2. The responder verification status is `VERIFIED`.
3. The responder availability status is `ONLINE`.
4. The responder has no active journey.
5. The responder is not suspended or otherwise restricted.
6. The responder satisfies the dispatch engine's approved location and operational eligibility rules.

Canonical verification statuses:

- `PENDING`
- `VERIFIED`
- `UNVERIFIED`
- `SUSPENDED`

Canonical availability statuses:

- `ONLINE`
- `OFFLINE`

Only `VERIFIED` responders may go online and receive or accept dispatch offers.

The backend must enforce these conditions even if the frontend has already filtered its responder list.

A responder becoming ineligible while an offer is pending must not be allowed to complete an invalid assignment.

## 8.3 Dispatch Offer Lifecycle

### Offer Timeout

The agreed responder offer timeout is **30 seconds**.

The backend generates the offer expiration timestamp and remains the authoritative source of expiration.

Each offer must have:

- A unique offer ID.
- An emergency ID.
- A responder ID.
- A creation timestamp.
- An expiration timestamp.
- A current offer status.

Recommended offer statuses:

- `PENDING`
- `ACCEPTED`
- `DECLINED`
- `EXPIRED`
- `CANCELLED`

These statuses describe an individual offer, not the overall emergency state.

### Lifecycle

1. The dispatch engine identifies an eligible responder.
2. The backend creates a pending offer.
3. The backend sets `expiresAt` to 30 seconds after the offer's creation time.
4. The frontend receives the offer and displays the remaining response time.
5. The responder accepts or declines.
6. If no valid response is received before expiration, the backend marks the offer `EXPIRED`.
7. The dispatch engine determines the next permitted action according to the approved retry and escalation policy.

The frontend must not extend an offer's expiration time or independently mark it as accepted.

### Expiration Enforcement

- The backend must compare acceptance time against the authoritative expiration time.
- An acceptance received after expiration must be rejected.
- An expired offer must never create a responder assignment.
- Duplicate acceptance requests must not create duplicate assignments.
- Expiration processing must be safe if the same offer is processed more than once.
- The backend must handle delayed network delivery without extending the original 30-second deadline.

## 8.4 Responder Active Offers

### Endpoint

`GET /api/v1/responder/offers/active`

### Purpose

Returns the authenticated responder's currently pending dispatch offers.

### Authorization

- Authenticated responder only.
- The responder must be eligible to receive offers.
- The backend derives the responder ID from the authenticated principal.

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "offers": [
      {
        "offerId": "uuid",
        "emergencyId": "uuid",
        "status": "PENDING",
        "createdAt": "2026-11-12T10:00:00Z",
        "expiresAt": "2026-11-12T10:00:30Z",
        "pickup": {
          "address": "Example Street",
          "latitude": 7.7310,
          "longitude": 8.5360
        }
      }
    ]
  }
}
```

The response must contain only information necessary for the responder to evaluate and fulfil the transportation request.

It must not expose unnecessary patient medical information, clinical notes, or sensitive pregnancy information.

The backend must return an empty offers array when no pending offers exist.

## 8.5 Accepting a Responder Offer

### Endpoint

`POST /api/v1/responder/offers/{offerId}/accept`

### Purpose

Allows an eligible responder to accept a pending emergency transportation offer.

### Authorization

- Authenticated responder only.
- The responder must be the recipient of the specified offer.
- The backend derives the responder identity from authentication.

### Request Body

No request body is required.

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "offerId": "uuid",
    "emergencyId": "uuid",
    "offerStatus": "ACCEPTED",
    "emergencyStatus": "ACCEPTED",
    "assignedResponderId": "uuid",
    "acceptedAt": "2026-11-12T10:00:15Z"
  }
}
```

### Acceptance Rules

The backend must verify that:

1. The offer exists.
2. The authenticated responder owns the offer.
3. The offer remains `PENDING`.
4. The offer has not expired.
5. The emergency remains eligible for assignment.
6. The responder remains `VERIFIED` and `ONLINE`.
7. The responder has no active journey.
8. No other responder has already been assigned to the emergency.

### Atomic Assignment

Offer acceptance and emergency assignment must be handled atomically in a database transaction.

The transaction must ensure that:

- The offer becomes `ACCEPTED`.
- The emergency becomes `ACCEPTED`.
- The responder becomes assigned to that emergency.
- The responder's active-journey restriction is enforced.
- Conflicting offers for the same emergency cannot produce multiple assignments.

If any required operation fails, the transaction must roll back.

The backend must use appropriate database constraints, locking, or conditional updates to protect against simultaneous acceptance requests.

A successful acceptance must not be reported until the assignment transaction has committed.

## 8.6 Declining a Responder Offer

### Endpoint

`POST /api/v1/responder/offers/{offerId}/decline`

### Purpose

Allows the responder to decline an offer before it expires.

### Authorization

Authenticated recipient of the specified offer only.

### Request Body

```json
{
  "reason": "UNAVAILABLE"
}
```

The reason is optional unless a later business rule makes it mandatory.

Suggested reason values:

- `UNAVAILABLE`
- `TOO_FAR`
- `VEHICLE_ISSUE`
- `OTHER`

These are proposed values and must be confirmed before being enforced as a closed enum.

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "offerId": "uuid",
    "emergencyId": "uuid",
    "offerStatus": "DECLINED",
    "declinedAt": "2026-11-12T10:00:15Z"
  }
}
```

### Decline Rules

- Only the recipient may decline the offer.
- Only a pending offer may be declined.
- A declined offer must not create an assignment.
- The backend records the decline timestamp and optional reason.
- The dispatch engine may consider another eligible responder according to the approved dispatch policy.
- Declining an offer must not create an active journey for the responder.
- If the responder has no active journey and remains eligible, the backend may retain or restore their availability according to the approved availability policy.

## 8.7 Offer Expiration

Offer expiration is controlled by the backend.

When an offer reaches its 30-second deadline without a valid response:

- The offer becomes `EXPIRED`.
- The backend records the expiration timestamp.
- The offer can no longer be accepted.
- The dispatch engine determines whether another responder should be considered or whether escalation is required.
- The frontend must stop presenting the expired offer as actionable.

Expiration must not be interpreted as proof that the responder deliberately ignored the emergency. Temporary connectivity loss may explain a missing response.

The backend must distinguish offer expiration from the emergency's overall state.

## 8.8 Dispatch Retry and Responder Reassignment

### General Rules

Dispatch retries and reassignment must be controlled by the backend.

The backend must preserve:

- Previous responder offers.
- Acceptance and decline outcomes.
- Expiration records.
- Assignment history.
- Reassignment reasons.
- Relevant timestamps.
- Dispatch escalation history.

A new offer must not erase the history of earlier offers.

### Reassignment Before Patient Boarding

Automatic reassignment may be considered before `PATIENT_ONBOARD`, subject to approved dispatch policy.

Examples include:

- A responder declines an offer.
- An offer expires without acceptance.
- An assigned responder becomes unable to continue before patient boarding.
- An assigned responder cannot be contacted and the failure is sufficiently established.

Reassignment must be performed through a controlled backend operation and must preserve the previous assignment history.

### Absolute Post-Boarding Safety Rule

Once an emergency reaches `PATIENT_ONBOARD`, automatic responder reassignment is permanently prohibited for that journey.

If the assigned responder cannot continue after patient boarding:

1. Preserve the original responder assignment.
2. Preserve the original journey and assignment history.
3. Record the incident and server-generated timestamp.
4. Escalate to authorised human dispatch intervention.
5. Allow the human dispatcher to coordinate a safe alternative transportation arrangement.
6. Record any subsequent operational action without rewriting the original journey history.

The backend must never treat a post-boarding vehicle breakdown, responder failure, or inability to continue as an ordinary automatic dispatch reassignment.

This rule is a mandatory safety invariant and must be enforced in backend business logic and database operations.

## 8.9 Dispatch Escalation

Human dispatch intervention is required when automated dispatch cannot safely or successfully resolve an emergency.

Escalation may be required when:

- No eligible responder can be found.
- All permitted offers have been exhausted.
- Dispatch repeatedly fails.
- An accepted responder becomes unavailable and the patient has not yet boarded.
- A responder cannot continue after `PATIENT_ONBOARD`.
- A critical operational failure requires human coordination.

The backend must record:

- Emergency ID.
- Escalation reason.
- Escalation timestamp.
- Previous dispatch attempts.
- Current responder assignment, if any.
- Escalation status.
- Human dispatcher actions and timestamps.

The emergency must enter the appropriate escalation workflow according to the emergency state machine.

Automated dispatch may resume only when an authorised and eligible recovery path has been approved.

An unresolved escalation must not be silently dismissed or treated as successful completion.

## 8.10 Dispatch Timeout and Retry Policy — Pending Approval

The 30-second offer timeout is confirmed.

However, the following dispatch policy values have not yet been finalised:

- Maximum number of responders to contact per dispatch cycle.
- Maximum number of dispatch attempts.
- Whether offers are sent sequentially or to multiple responders.
- Whether multiple pending offers may exist for one emergency.
- Delay between dispatch attempts.
- Geographic search radius and expansion strategy.
- Exact conditions for moving from automated dispatch to human escalation.
- Whether and how an emergency can return from human escalation to automated dispatch.

Until these values are approved, implementation must not invent fixed retry limits or escalation thresholds.

Regardless of the final policy, the backend must enforce the post-boarding prohibition on automatic reassignment.

## 8.11 Dispatch State and WebSocket Events

The backend should notify authorised clients when important dispatch events occur.

The existing WebSocket event contract includes:

- `emergency.state_changed`
- `emergency.responder_assigned`
- `emergency.responder_location`
- `emergency.facility_selected`

The dispatch implementation should ensure that relevant clients receive authoritative updates when:

- A responder offer is created.
- An offer is accepted.
- An offer is declined.
- An offer expires.
- A responder is assigned.
- Dispatch enters human escalation.
- An authorised reassignment occurs before patient boarding.

Exact additional event names and payload schemas must be agreed with the frontend team before implementation.

WebSocket notifications are not the authoritative record of assignment. The database and REST API remain authoritative.

After reconnection, clients must be able to retrieve the current emergency and assignment state through REST.

## 8.12 Error Responses

| Error Code | HTTP Status | Meaning |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Authentication is missing or invalid |
| `FORBIDDEN` | 403 | User is not authorised to access the offer |
| `NOT_FOUND` | 404 | Offer or emergency does not exist |
| `VERIFICATION_REQUIRED` | 403 | Responder is not verified |
| `OFFER_EXPIRED` | 409 | Offer has passed its expiration deadline |
| `OFFER_ALREADY_PROCESSED` | 409 | Offer has already been accepted, declined, expired, or cancelled |
| `ACTIVE_JOURNEY_EXISTS` | 409 | Responder already has an active journey |
| `ACTIVE_EMERGENCY_EXISTS` | 409 | Emergency already has an active assignment |
| `INVALID_STATE_TRANSITION` | 409 | Requested dispatch action conflicts with the emergency state |
| `DISPATCH_UNAVAILABLE` | 503 | Dispatch service cannot safely process the request |
| `VALIDATION_ERROR` | 422 | Request parameters are invalid |

All errors must use the standard API error envelope defined in Section 1.

## 8.13 Database and Transaction Requirements

Dispatch implementation must preserve consistency across emergency, responder, offer, and assignment records.

The backend must:

- Store each offer as an independently identifiable record.
- Store offer creation and expiration timestamps using server-generated UTC timestamps.
- Preserve offer history after acceptance, decline, expiration, or cancellation.
- Prevent duplicate active assignments.
- Prevent a responder from having multiple active journeys.
- Protect concurrent offer acceptance with transactions and appropriate database-level safeguards.
- Ensure assignment and emergency state changes are atomic.
- Preserve original responder assignment history during reassignment.
- Prevent automatic reassignment after `PATIENT_ONBOARD`.
- Record escalation and incident history without deleting earlier records.

The dispatch engine must not rely exclusively on frontend state or WebSocket delivery to enforce these rules.

## 8.14 Implementation Boundary

The following are established requirements:

- Only verified responders may receive and accept offers.
- Only online responders without an active journey are eligible.
- Offer timeout is 30 seconds.
- The backend owns expiration and assignment decisions.
- Acceptance must be atomic.
- Duplicate assignments must be prevented.
- Offer and assignment history must be preserved.
- Automatic reassignment is prohibited after `PATIENT_ONBOARD`.
- Post-boarding responder failure requires human dispatch intervention.

The following require further agreement:

- Dispatch retry limits.
- Sequential versus parallel offers.
- Geographic matching and radius expansion.
- Escalation thresholds.
- Reassignment policy before boarding.
- Additional dispatch WebSocket event names and payloads.
- Decline reason vocabulary.

These pending values must be agreed with the frontend and product stakeholders before the dispatch engine is treated as complete.

# Section 9 — Emergency Journey and Responder Location APIs

## 9.1 Purpose and Scope

The Emergency Journey and Responder Location APIs manage the operational progress of an accepted emergency transportation assignment.

They allow the assigned responder to:

- Retrieve their active journey.
- Report journey milestones.
- Submit location updates during an active assignment.
- Record arrival at the pickup location.
- Confirm that the patient has boarded.
- Confirm the beginning of transportation.
- Record arrival at the receiving facility.
- Complete the journey through the approved operational handover process.

The backend remains authoritative for emergency states, responder assignments, journey history, timestamps, and handover records.

The frontend must not independently change emergency states or treat a location update as proof that a journey milestone has occurred.

## 9.2 Retrieve Active Responder Journey

### Endpoint

`GET /api/v1/responder/journey/active`

### Purpose

Returns the authenticated responder's currently active emergency journey.

### Authorization

- Authenticated responder only.
- The responder ID must be derived from the authenticated principal.
- The responder must be the assigned responder for the returned emergency.

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "journey": {
      "emergencyId": "uuid",
      "status": "ACCEPTED",
      "assignedAt": "2026-11-12T10:00:00Z",
      "pickup": {
        "address": "Example Street",
        "latitude": 7.7310,
        "longitude": 8.5360
      },
      "receivingFacility": null,
      "patient": {
        "displayName": "Patient"
      }
    }
  }
}
```

The `journey` value must be `null` when the responder has no active journey.

### Data Protection

- Only information necessary for transportation must be exposed.
- Sensitive pregnancy information, medical history, blood group, allergies, and clinical notes must not be exposed to the responder through this endpoint.
- The backend must not expose another responder's active journey.
- The endpoint must return the current authoritative emergency state.

## 9.3 Journey Milestone Updates

### Endpoint

`POST /api/v1/responder/journey/{emergencyId}/milestone`

### Purpose

Allows the assigned responder to report a permitted operational journey milestone.

### Authorization

- Authenticated responder only.
- The authenticated responder must be assigned to the specified emergency.
- The emergency must be in a state that permits the requested transition.

### Request Body

```json
{
  "milestone": "PICKUP_ARRIVED"
}
```

Supported milestone values:

- `PICKUP_ARRIVED`
- `PATIENT_ONBOARD`
- `IN_TRANSIT`
- `ARRIVED`

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "emergencyId": "uuid",
    "previousStatus": "ACCEPTED",
    "currentStatus": "PICKUP_ARRIVED",
    "recordedAt": "2026-11-12T10:10:00Z"
  }
}
```

`recordedAt` must be generated by the backend.

### Milestone Transition Rules

| Current State | Requested Milestone | Result |
|---|---|---|
| `ACCEPTED` | `PICKUP_ARRIVED` | Allowed |
| `PICKUP_ARRIVED` | `PATIENT_ONBOARD` | Allowed |
| `PATIENT_ONBOARD` | `IN_TRANSIT` | Allowed only when a receiving facility has been established |
| `HOSPITAL_SELECTED` | `IN_TRANSIT` | Allowed |
| `IN_TRANSIT` | `ARRIVED` | Allowed |

All other transitions must be rejected unless explicitly permitted by the emergency state machine.

### Important Rules

1. The responder cannot update another responder's emergency.
2. The responder cannot skip required milestones.
3. The responder cannot directly set `COMPLETED`.
4. The responder cannot use a milestone request to cancel an emergency.
5. The backend must validate the current state before accepting the requested transition.
6. The state update and journey history record must be committed atomically.
7. Every accepted milestone must have a server-generated timestamp.
8. Duplicate requests must not create duplicate journey history entries or repeat side effects.

The frontend may display the label "En Route to Pickup" while the backend state remains `ACCEPTED`. This is a presentation label, not a separate backend state.

## 9.4 Patient Boarding Safety Rule

The transition to `PATIENT_ONBOARD` is a critical safety boundary.

Once the backend accepts this milestone:

- The patient is considered to have boarded the assigned responder's vehicle.
- Automatic responder reassignment is permanently prohibited for that journey.
- The original responder assignment must be preserved.
- Subsequent responder inability to continue must trigger human dispatch intervention.
- The backend must preserve the original assignment and journey history.
- Any alternative transportation arrangement must be coordinated through authorised human intervention.

This restriction must be enforced by backend business logic and database operations.

A location update, network interruption, or missing WebSocket event must never independently reverse the boarding state or trigger automatic reassignment.

## 9.5 Receiving Facility Requirement Before Transportation

Before the emergency enters `IN_TRANSIT`, a receiving facility must have been established.

The backend must validate that:

- A receiving facility is recorded for the emergency.
- The facility exists.
- The facility satisfies the approved eligibility requirements.
- The emergency is in a permitted state for transportation to begin.

The optional `HOSPITAL_SELECTED` state may be used to represent the facility-selection stage.

The initial facility-selection actor and endpoint remain subject to the pending approval recorded in Section 7. The journey milestone API must not silently assume that the responder is authorised to select a facility.

If no receiving facility has been established, the backend must reject the transition to `IN_TRANSIT` with `INVALID_STATE_TRANSITION` or an appropriately defined facility-related error.

## 9.6 Responder Location Updates

### Proposed Endpoint

`POST /api/v1/responder/journey/{emergencyId}/location`

### Purpose

Allows the assigned responder's application to submit geographic location updates during an active journey.

Location updates support:

- Patient visibility of responder movement.
- Emergency journey monitoring.
- Dispatch oversight.
- Operational coordination.
- Accurate location recovery after temporary network interruptions.

### Authorization

- Authenticated responder only.
- The authenticated responder must be assigned to the specified emergency.
- The emergency must be in an eligible active state.
- The backend must reject location updates for unrelated emergencies.

### Request Body

```json
{
  "latitude": 7.7310,
  "longitude": 8.5360,
  "accuracyMeters": 12.5,
  "headingDegrees": 180,
  "speedMetersPerSecond": 8.3,
  "capturedAt": "2026-11-12T10:12:00Z"
}
```

Field requirements:

| Field | Type | Required | Description |
|---|---|---|---|
| `latitude` | number | Yes | Latitude of the reported location |
| `longitude` | number | Yes | Longitude of the reported location |
| `accuracyMeters` | number | No | Reported GPS accuracy |
| `headingDegrees` | number | No | Direction of travel |
| `speedMetersPerSecond` | number | No | Reported speed |
| `capturedAt` | timestamp | Yes | Device-reported location capture time |

### Validation Rules

- Latitude must be between -90 and 90.
- Longitude must be between -180 and 180.
- Accuracy must not be negative.
- Heading, when supplied, must be within the valid range of 0–360 degrees.
- Speed, when supplied, must not be negative.
- Timestamps must be valid RFC3339 timestamps.
- The backend must distinguish device capture time from server receipt time.
- The backend must not blindly trust client timestamps as authoritative event timestamps.
- Invalid or stale location updates must not overwrite a newer accepted location.
- Implausible location changes must be handled through validation and monitoring rather than silently treated as verified movement.

### Success Response

HTTP `202 Accepted`

```json
{
  "success": true,
  "data": {
    "emergencyId": "uuid",
    "locationAccepted": true,
    "receivedAt": "2026-11-12T10:12:02Z"
  }
}
```

`receivedAt` must be generated by the backend.

The response confirms that the backend accepted the location update for processing. It does not mean that the location has been independently verified.

## 9.7 Location Update Frequency and Connectivity Policy

Location update frequency must balance:

- Emergency response visibility.
- Battery consumption.
- Mobile data usage.
- Network reliability.
- Location accuracy.
- Backend processing capacity.

The following policy values remain subject to technical testing and agreement:

- Normal location reporting interval.
- Minimum permitted reporting interval.
- Maximum acceptable location age.
- Location history retention period.
- Offline buffering limits.
- Recovery behaviour after network restoration.

The backend must not assume that a missing location update means the responder has abandoned the journey.

### Temporary Connectivity Loss

When a responder loses network connectivity:

1. The application may temporarily retain location updates locally.
2. The backend must preserve the last accepted location.
3. The frontend must distinguish the last known location from a live location.
4. Reconnection must not create a new emergency assignment.
5. The backend must validate buffered updates before accepting them.
6. Old buffered locations must not overwrite newer accepted locations.
7. Temporary connectivity loss alone must not trigger `FAILED_CONTACT`.

The backend must not automatically reassign a responder because of temporary internet loss.

## 9.8 Location Data and Privacy

Responder location data is sensitive operational information.

The backend must enforce the following rules:

- Location access must be restricted to authorised users with a legitimate emergency-related purpose.
- A patient's active journey may expose only the location information required to follow that journey.
- Responders must not have unrestricted access to other responders' location histories.
- Administrative access must be permission-controlled and auditable.
- Location data must not be exposed through public endpoints.
- Location records must not contain unnecessary patient medical information.
- Access to location history must follow the approved retention and privacy policy.

The responder's live location should be shared in the context of an authorised active journey, not exposed as unrestricted continuous tracking.

The exact policy for location access before acceptance, after completion, and outside an active journey requires agreement with the frontend and privacy stakeholders.

## 9.9 Arrival at Receiving Facility

The responder reports arrival through the milestone endpoint:

```json
{
  "milestone": "ARRIVED"
}
```

The backend must validate that:

- The emergency is currently `IN_TRANSIT`.
- The authenticated responder is the assigned responder.
- A receiving facility has been established.
- The transition is permitted by the state machine.

After successful processing, the emergency state becomes `ARRIVED`.

### Important Completion Rule

`ARRIVED` does not mean that the journey is completed.

The emergency must remain in `ARRIVED` until the assigned responder records the required operational handover using the endpoint defined in Section 9.10.

The backend must reject attempts to complete the emergency simply by submitting an `ARRIVED` milestone.

## 9.10 Operational Facility Handover

### Endpoint

`POST /api/v1/responder/journey/{emergencyId}/handover`

### Purpose

Records the responder's explicit operational handover of the patient at the receiving facility.

This operation is the required final operational step before the emergency can become `COMPLETED`.

### Authorization

- Authenticated responder only.
- The responder must be the currently assigned responder.
- The emergency must be in `ARRIVED`.
- The receiving facility must be valid.

### Request Body

```json
{
  "facilityId": "uuid",
  "handoverNotes": "Patient handed over to the receiving facility."
}
```

`handoverNotes` must contain operational or transportation information only.

Clinical observations, diagnosis, triage information, and sensitive pregnancy information must not be entered into this field.

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "emergencyId": "uuid",
    "status": "COMPLETED",
    "handover": {
      "facilityId": "uuid",
      "recordedBy": "uuid",
      "recordedAt": "2026-11-12T10:45:00Z",
      "handoverNotes": "Patient handed over to the receiving facility.",
      "facilityAcknowledged": false
    }
  }
}
```

### Handover Rules

1. Only the assigned responder may submit the required handover.
2. The emergency must be in `ARRIVED`.
3. The receiving facility must be valid.
4. The backend generates the authoritative handover timestamp.
5. The handover record must be immutable.
6. Receiving-facility acknowledgement may be recorded when available, but is not mandatory.
7. Facility staff authentication or acknowledgement is not a mandatory completion requirement.
8. The backend transitions the emergency to `COMPLETED` after successfully recording the required handover.
9. Handover creation, emergency completion, and completed-trip statistics must be committed atomically.
10. Duplicate handover requests must not create duplicate handover records or increment completed-trip statistics more than once.

The facility recorded during handover must represent the actual receiving facility. If it differs from the originally selected destination, the backend must preserve the discrepancy and record it as an auditable operational change rather than silently overwriting the original selection.

## 9.11 Journey History and Audit Requirements

The backend must preserve an auditable journey history.

Each accepted milestone must record:

- Emergency ID.
- Previous state.
- New state.
- Actor ID.
- Server-generated timestamp.
- Relevant operational metadata.

Location history must be managed separately from milestone history.

Handover records must be preserved independently and must not be overwritten by subsequent emergency updates.

The backend must not delete or rewrite historical assignment, journey, or handover events to make a journey appear to have followed a different sequence.

All state-changing operations must preserve transaction integrity.

## 9.12 Error Responses

| Error Code | HTTP Status | Meaning |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Authentication is missing or invalid |
| `FORBIDDEN` | 403 | User is not authorised to access or update this journey |
| `NOT_FOUND` | 404 | Emergency or facility does not exist |
| `VALIDATION_ERROR` | 422 | Invalid milestone, coordinates, timestamp, or request data |
| `INVALID_STATE_TRANSITION` | 409 | Requested journey transition is not permitted |
| `ACTIVE_JOURNEY_EXISTS` | 409 | Responder already has an active journey |
| `FACILITY_UNAVAILABLE` | 409 | Receiving facility is not eligible for the operation |
| `HANDOVER_ALREADY_RECORDED` | 409 | A handover has already been recorded |
| `DISPATCH_UNAVAILABLE` | 503 | Required operational coordination service is unavailable |

All errors must use the standard API error envelope defined in Section 1.

## 9.13 WebSocket Integration

The journey APIs must integrate with the existing authenticated WebSocket event system.

The existing event contract includes:

- `emergency.state_changed`
- `emergency.responder_assigned`
- `emergency.responder_location`
- `emergency.facility_selected`

The backend should publish relevant state and location updates to authorised subscribers.

WebSocket events must:

- Be generated from successfully committed backend operations.
- Carry the relevant emergency identifier.
- Include server-generated event timestamps.
- Include event identifiers or sequence information to support missed-event detection.
- Avoid exposing sensitive patient information.
- Respect the access permissions of each subscriber.

WebSocket messages must not replace REST endpoints as the authoritative source of journey state.

After reconnecting, the frontend must retrieve an authoritative REST snapshot and reconcile it with any subsequently received events.

The exact event payloads, sequence-number strategy, authentication ticket mechanism, and reconnection contract remain subject to the WebSocket specification.

## 9.14 Implementation Boundary

The following requirements are established:

- The backend controls all journey state transitions.
- Only the assigned responder can update their journey.
- Journey milestones follow the approved state machine.
- `PATIENT_ONBOARD` permanently prohibits automatic responder reassignment.
- A receiving facility must be established before `IN_TRANSIT`.
- `ARRIVED` does not automatically complete an emergency.
- Explicit operational handover is mandatory.
- Handover is immutable and uses a server-generated timestamp.
- Facility acknowledgement is optional.
- Completed-trip statistics must be updated exactly once.
- Temporary network loss must not independently trigger `FAILED_CONTACT` or reassignment.

The following require further approval:

- Location update frequency and rate limits.
- Location history retention period.
- Offline buffering and recovery limits.
- Location visibility before acceptance and after completion.
- Exact WebSocket event payloads and sequence handling.
- Whether any additional operational milestones are required.

These outstanding decisions must be resolved before the location-tracking and realtime journey features are considered production-ready.

# Section 10 — WebSocket and Real-Time Communication APIs

## 10.1 Purpose and Scope

AIDORA uses WebSockets to deliver real-time emergency and transportation updates to authorised clients.

The WebSocket system supports:

- Live emergency state updates.
- Responder assignment notifications.
- Responder location updates.
- Receiving-facility selection notifications.
- Dispatch and journey progress notifications.
- Reconnection and missed-event recovery.

REST APIs remain the authoritative interface for retrieving emergency records and performing state-changing operations.

WebSocket communication is primarily used for server-to-client notifications. Critical emergency operations must not depend exclusively on a WebSocket connection.

The backend must remain reliable when clients temporarily disconnect, reconnect, or receive events out of order.

## 10.2 WebSocket Connection

### Proposed Endpoint

`GET /api/v1/ws`

The WebSocket connection must be authenticated before the server permits access to emergency information.

### Authentication Requirement

AIDORA must not place long-lived access tokens or refresh tokens in WebSocket URL query parameters.

Instead, the recommended authentication flow is:

1. The client authenticates through the REST authentication API.
2. The client requests a short-lived, single-use WebSocket connection ticket.
3. The backend validates the authenticated session and issues the ticket.
4. The client opens the WebSocket connection and presents the ticket using the agreed connection-authentication mechanism.
5. The backend validates the ticket before establishing the connection.
6. The ticket is invalidated after successful use or expiration.

The exact ticket endpoint and authentication exchange must be finalised with the authentication specification.

### Security Requirements

- WebSocket connections must use `wss://` in production.
- Only authenticated users may establish authorised connections.
- The backend must verify the user's role and resource permissions.
- A client must not subscribe to an emergency merely by supplying its UUID.
- Expired, revoked, invalid, or previously consumed tickets must be rejected.
- Connection authentication failures must not expose sensitive account or session information.
- WebSocket tickets must not be written to application logs.
- Connection limits and authentication rate limits must be enforced.

## 10.3 Connection Lifecycle

After successful authentication, the backend establishes a WebSocket connection.

The connection lifecycle must support:

- Connection establishment.
- Authentication validation.
- Authorised event delivery.
- Heartbeat or ping/pong handling.
- Graceful connection closure.
- Detection of disconnected clients.
- Reconnection using a newly issued connection ticket.

The backend must not assume that a client remains connected simply because a connection was previously established.

The frontend must distinguish between:

- `CONNECTED`
- `RECONNECTING`
- `DISCONNECTED`

These are client connection conditions, not emergency states.

Temporary WebSocket disconnection must not independently change an emergency state, cancel a journey, mark a responder as unavailable, or trigger `FAILED_CONTACT`.

## 10.4 Authorised Event Subscription

The backend must control which emergency events each connected client may receive.

Authorisation must be based on the authenticated user's identity, role, and relationship to the emergency.

### Access Rules

| User Role | Permitted Event Access |
|---|---|
| Patient | Their own emergency and authorised journey updates |
| Assigned responder | Their assigned emergency and operational updates |
| Administrator | Only emergency information permitted by administrative privileges |
| Unassigned responder | No access to another responder's active emergency updates |

The backend must not rely on frontend filtering to protect emergency information.

A client must not be allowed to subscribe to another patient's emergency by changing an emergency ID.

Subscription authorisation must be checked whenever a subscription is created and whenever permissions or assignments change in a way that affects access.

## 10.5 Standard WebSocket Event Envelope

All server-to-client events should use a consistent JSON envelope.

### Proposed Structure

```json
{
  "eventId": "uuid",
  "sequence": 105,
  "event": "emergency.state_changed",
  "emergencyId": "uuid",
  "occurredAt": "2026-11-12T10:15:00Z",
  "data": {
    "previousStatus": "ACCEPTED",
    "currentStatus": "PICKUP_ARRIVED"
  }
}
```

### Field Definitions

| Field | Type | Description |
|---|---|---|
| `eventId` | UUID | Unique identifier for the event |
| `sequence` | integer | Ordering information within the defined event stream |
| `event` | string | Event name |
| `emergencyId` | UUID | Associated emergency |
| `occurredAt` | timestamp | Server-generated event timestamp |
| `data` | object | Event-specific information |

### Event Integrity Rules

- Event identifiers must be unique.
- Event timestamps must be generated by the backend.
- Sequence numbers must be monotonically increasing within their explicitly defined scope.
- The sequence scope must be documented and consistently enforced.
- Clients must not assume that arrival order is always the same as event creation order.
- Events must be generated from successfully committed backend operations.
- Duplicate event delivery must not cause duplicate business actions.
- Sensitive patient information must not be included unless explicitly authorised and necessary.

The sequence-number scope and event replay retention policy must be agreed before implementation.

## 10.6 Supported Event Types

The existing API contract defines four initial event types.

### 10.6.1 `emergency.state_changed`

Notifies authorised clients when an emergency changes state.

Example:

```json
{
  "eventId": "uuid",
  "sequence": 106,
  "event": "emergency.state_changed",
  "emergencyId": "uuid",
  "occurredAt": "2026-11-12T10:15:00Z",
  "data": {
    "previousStatus": "PICKUP_ARRIVED",
    "currentStatus": "PATIENT_ONBOARD"
  }
}
```

Rules:

- Only successfully committed state transitions may generate this event.
- The event must represent a valid transition in the emergency state machine.
- The event must not independently authorise another state transition.
- Clients must reconcile the event with the authoritative REST state when necessary.

### 10.6.2 `emergency.responder_assigned`

Notifies authorised clients that a responder has been assigned to an emergency.

Example:

```json
{
  "eventId": "uuid",
  "sequence": 107,
  "event": "emergency.responder_assigned",
  "emergencyId": "uuid",
  "occurredAt": "2026-11-12T10:16:00Z",
  "data": {
    "responderId": "uuid",
    "assignedAt": "2026-11-12T10:16:00Z"
  }
}
```

Rules:

- The event must only be published after the assignment transaction commits.
- The patient may receive the responder information approved for patient display.
- The responder may receive only information necessary for their assigned journey.
- An assignment notification must not be treated as permission to access unrelated emergencies.

### 10.6.3 `emergency.responder_location`

Notifies authorised clients of a responder's accepted location update.

Example:

```json
{
  "eventId": "uuid",
  "sequence": 108,
  "event": "emergency.responder_location",
  "emergencyId": "uuid",
  "occurredAt": "2026-11-12T10:17:00Z",
  "data": {
    "latitude": 7.7310,
    "longitude": 8.5360,
    "accuracyMeters": 12.5,
    "capturedAt": "2026-11-12T10:16:58Z",
    "receivedAt": "2026-11-12T10:17:00Z"
  }
}
```

Rules:

- The location must belong to the responder assigned to the emergency.
- Only accepted and validated location updates may be broadcast.
- The event must distinguish device capture time from server receipt time.
- Clients must display stale or last-known locations appropriately.
- Location events must only be delivered to authorised subscribers.
- The backend must not broadcast unrestricted responder location histories.

Location event frequency and delivery throttling must follow the approved location-reporting policy.

### 10.6.4 `emergency.facility_selected`

Notifies authorised clients when a receiving facility has been successfully established for an emergency.

Example:

```json
{
  "eventId": "uuid",
  "sequence": 109,
  "event": "emergency.facility_selected",
  "emergencyId": "uuid",
  "occurredAt": "2026-11-12T10:18:00Z",
  "data": {
    "facilityId": "uuid",
    "selectedAt": "2026-11-12T10:18:00Z"
  }
}
```

Rules:

- The event must only be published after the facility-selection operation commits.
- The backend must enforce the approved facility-selection permissions.
- The event must not imply that the facility has acknowledged receipt of the patient.
- The actual receiving facility recorded during handover must remain separately auditable.
- The event must not be generated merely because a client viewed a facility.

The authorised facility-selection actor and operation remain pending approval as documented in Section 7.

## 10.7 Additional Dispatch and Journey Events

The following additional event names are proposed for consideration:

| Proposed Event | Purpose |
|---|---|
| `dispatch.offer_created` | Notify a responder of a new offer |
| `dispatch.offer_expired` | Notify a client that an offer expired |
| `dispatch.offer_declined` | Notify authorised dispatch clients of a decline |
| `dispatch.escalated` | Notify authorised users that human intervention is required |
| `emergency.handover_completed` | Notify authorised clients that operational handover was recorded |

These names are proposals, not yet approved canonical event contracts.

The backend and frontend teams must agree on:

- Event names.
- Payload schemas.
- Recipient permissions.
- Event sequence behaviour.
- Whether an event is required or whether an existing event sufficiently communicates the change.

The backend must not expose sensitive dispatch information to unauthorised users.

## 10.8 Reconnection and Missed-Event Recovery

Mobile clients may disconnect because of:

- Weak mobile networks.
- Device sleep.
- Application backgrounding.
- Temporary loss of internet access.
- Server restarts.
- Network switching.

The backend must support recovery without assuming that all missed events can be delivered through the original connection.

### Reconnection Flow

1. The client detects that the WebSocket connection has closed.
2. The client enters `RECONNECTING`.
3. The client obtains a new short-lived connection ticket.
4. The client establishes a new authenticated WebSocket connection.
5. The client requests the authoritative emergency snapshot through REST.
6. The client reconciles its local state with the REST response.
7. The client processes subsequent WebSocket events.

### REST Recovery

The existing emergency and journey REST endpoints remain authoritative for recovery.

The backend must provide the client with enough current information to restore:

- Emergency state.
- Assigned responder.
- Receiving facility, when established.
- Current journey milestones.
- Relevant operational status.
- Latest accepted responder location, when authorised.

The client must not rely solely on replaying every event missed during disconnection.

### Sequence Gap Detection

If the client receives a sequence number that indicates a missing event:

- It must not assume that the missing event can safely be reconstructed.
- It should request an authoritative REST snapshot.
- It must reconcile its local state before continuing normal event processing.
- It must ignore duplicate events that have already been processed.

Whether the backend will support event replay in addition to REST snapshot recovery remains a future design decision.

## 10.9 WebSocket Failure and Reconnection Rules

The following rules are mandatory:

- WebSocket disconnection does not cancel an emergency.
- WebSocket disconnection does not complete an emergency.
- WebSocket disconnection does not change responder assignment.
- WebSocket disconnection does not trigger automatic reassignment.
- Temporary connectivity loss does not independently trigger `FAILED_CONTACT`.
- REST APIs must remain available for authoritative state retrieval when the client can reach the backend.
- A failed WebSocket connection must not prevent the backend from processing valid REST operations.
- Reconnection must not create duplicate assignments or repeat completed journey operations.

The backend must support normal operation when a client is temporarily offline.

## 10.10 Heartbeats and Connection Management

The backend should implement WebSocket heartbeat handling to detect dead or unresponsive connections.

The implementation must define:

- Ping interval.
- Pong timeout.
- Maximum permitted connection lifetime.
- Idle connection policy.
- Maximum concurrent connections per user.
- Maximum message size.
- Server-side connection cleanup.

Exact timing values must be selected during implementation and validated under realistic mobile-network conditions.

Heartbeat failure must close the affected connection safely.

It must not directly modify the emergency state or responder availability.

## 10.11 Client-to-Server WebSocket Messages

The initial WebSocket contract is server-to-client notification.

Critical operations such as:

- Accepting or declining an offer.
- Updating an emergency milestone.
- Reporting a responder location.
- Cancelling an emergency.
- Recording facility handover.

must continue to use their documented REST endpoints.

The backend must not accept arbitrary client-supplied state changes through WebSocket messages.

If future bidirectional WebSocket functionality is required, each inbound message type must have a separate documented schema, authentication rule, validation policy, and authorisation rule.

## 10.12 Reliability and Event Delivery

The backend must treat WebSocket delivery as a potentially unreliable communication channel.

The implementation should support:

- Unique event identifiers.
- Defined event ordering.
- Duplicate-event detection.
- Reconnection.
- REST snapshot recovery.
- Safe handling of disconnected clients.
- Delivery only to authorised subscribers.

An event must not be considered successfully delivered merely because the backend attempted to write it to a WebSocket connection.

For critical state changes, the committed database record remains authoritative even if the notification cannot be delivered.

The backend should use a reliable event-publication strategy, such as a transactional outbox, so that database commits and event publication cannot silently diverge.

The outbox implementation and retention policy will be defined in the backend architecture and database design.

## 10.13 Error and Closure Handling

The backend must close unauthorised or invalid connections safely.

Recommended closure categories include:

- Normal closure.
- Authentication failure.
- Authorization failure.
- Expired connection ticket.
- Policy violation.
- Server shutdown.

WebSocket protocol closure codes should be used appropriately.

REST operations associated with WebSocket authentication and event recovery must use the standard API error envelope defined in Section 1.

WebSocket protocol errors must not expose internal database details, secrets, tokens, or stack traces.

## 10.14 Security and Privacy Requirements

The backend must enforce:

- Authenticated connection establishment.
- Role-based and resource-based event access.
- Short-lived, single-use connection tickets.
- No long-lived JWTs in WebSocket URLs.
- No unauthorised emergency subscriptions.
- No unrestricted location broadcasting.
- No unnecessary patient medical information in event payloads.
- Safe handling of expired sessions and revoked access.
- Connection and subscription rate limits.
- Auditability of sensitive access where required.

WebSocket security must be enforced on the server, not merely implemented through frontend navigation or UI restrictions.

## 10.15 Implementation Boundary

The following requirements are established:

- REST APIs remain authoritative.
- WebSockets provide real-time notifications.
- Connections require authentication and resource-level authorisation.
- Long-lived JWTs must not be placed in WebSocket URLs.
- The four existing emergency event types remain the initial event baseline.
- Events must be generated from committed backend operations.
- Temporary network loss must not alter emergency state or assignment.
- Reconnection must support REST snapshot recovery.
- Clients must handle duplicate, delayed, and missing events.
- Sensitive patient and responder information must be protected.

The following remain pending approval or implementation design:

- Exact connection-ticket endpoint and authentication exchange.
- Event sequence-number scope.
- Event replay and retention policy.
- Additional dispatch and handover event names.
- Heartbeat timing and connection limits.
- Detailed event payload schemas.
- Transactional outbox implementation and delivery guarantees.

These decisions must be finalised before the WebSocket system is considered production-ready.

# Section 11 — Notifications and Firebase Cloud Messaging (FCM)

## 11.1 Purpose and Scope

AIDORA uses Firebase Cloud Messaging (FCM) to deliver push notifications to registered mobile devices.

Push notifications support time-sensitive communication when users are not actively connected to the application through WebSockets.

The notification system supports:

- Emergency request acknowledgements.
- Responder offer notifications.
- Responder assignment notifications.
- Emergency journey updates.
- Dispatch escalation notifications for authorised users.
- Important operational alerts.
- Relevant account and security notifications.

The backend is responsible for deciding when notifications should be generated, identifying authorised recipients, and communicating with FCM.

The mobile application is responsible for receiving, displaying, and handling notifications according to the user's device and notification permissions.

**Important principle:** A push notification is not an authoritative emergency state change. The backend database and REST APIs remain authoritative.

## 11.2 Notification Architecture

The notification flow is:

1. A valid backend operation occurs.
2. The operation commits successfully to the database.
3. The backend identifies the notification event and authorised recipients.
4. The backend creates a notification delivery task.
5. The notification service sends the message through FCM.
6. FCM attempts delivery to the recipient's registered device.
7. The mobile application receives the notification when delivery is possible.
8. The application retrieves the latest authoritative information through REST when necessary.

Notification delivery must not be required for a database transaction to succeed.

If FCM is temporarily unavailable, the underlying emergency operation must remain valid and persisted.

The backend must record delivery failures and handle retryable failures according to the notification delivery policy.

## 11.3 Device Registration

### Proposed Endpoint

`POST /api/v1/devices/register`

### Purpose

Registers a mobile device and its FCM registration token with the authenticated user's account.

### Authorization

- Authenticated user only.
- The user ID must be derived from the authenticated principal.
- The backend must not accept a client-supplied user ID as proof of ownership.

### Request Body

```json
{
  "fcmToken": "firebase-registration-token",
  "platform": "ANDROID",
  "deviceId": "device-installation-identifier"
}
```

Field definitions:

| Field | Type | Required | Description |
|---|---|---|---|
| `fcmToken` | string | Yes | Current FCM registration token |
| `platform` | string | Yes | Device platform |
| `deviceId` | string | Yes | Application-generated device installation identifier |

Supported platforms:

- `ANDROID`
- `IOS`

The `deviceId` must be an application-generated identifier, not a hardware serial number or another unnecessary permanent device identifier.

### Success Response

HTTP `200 OK`

```json
{
  "success": true,
  "data": {
    "registered": true
  }
}
```

### Registration Rules

- FCM tokens must be associated with the authenticated user.
- Registering an existing token again must update or refresh its registration safely.
- A user may have multiple registered devices.
- A device token must not be assumed to belong permanently to one user.
- When a device is signed out or changes account, the backend must update the association appropriately.
- The backend must never expose FCM tokens through public profile or emergency APIs.
- FCM tokens must be protected as sensitive operational identifiers.

The backend must support token refresh because FCM registration tokens can change.

## 11.4 Device Deregistration

### Proposed Endpoint

`DELETE /api/v1/devices/{deviceId}`

### Purpose

Removes the association between a device installation and the authenticated user's account.

### Authorization

- Authenticated user only.
- The device must belong to the authenticated user.
- A user must not deregister another user's device.

### Success Response

HTTP `204 No Content`

### Deregistration Rules

- Deregistration must remove or deactivate the device-token association.
- Future notifications must not be sent to the deregistered device.
- Deregistration must not delete the user's account.
- Deregistration must not cancel an emergency or alter an active journey.
- A device may be registered again after successful authentication.

If an FCM token becomes invalid, the backend must mark it inactive or remove its association according to the token-management policy.

## 11.5 Notification Categories

The initial notification categories are:

| Category | Purpose | Potential Recipient |
|---|---|---|
| `EMERGENCY_REQUEST` | Confirms receipt of an emergency request | Patient |
| `RESPONDER_OFFER` | Alerts a responder about a new offer | Eligible responder |
| `RESPONDER_ASSIGNED` | Confirms responder assignment | Patient and assigned responder |
| `JOURNEY_UPDATE` | Reports an important journey milestone | Patient and assigned responder |
| `FACILITY_UPDATE` | Reports an authorised receiving-facility update | Patient and assigned responder |
| `DISPATCH_ESCALATION` | Alerts authorised operational personnel | Authorised dispatch personnel |
| `ACCOUNT_SECURITY` | Reports important account security events | Relevant account owner |

These categories describe notification purposes. They are not emergency states or dispatch offer statuses.

The backend must determine recipients from authenticated identities, assignments, permissions, and the underlying event.

## 11.6 Notification Payload Structure

Notifications should use a consistent payload structure.

### Proposed Data Payload

```json
{
  "notificationId": "uuid",
  "type": "RESPONDER_ASSIGNED",
  "emergencyId": "uuid",
  "createdAt": "2026-11-12T10:20:00Z",
  "data": {
    "titleKey": "responder_assigned_title",
    "bodyKey": "responder_assigned_body"
  }
}
```

### Payload Rules

- `notificationId` uniquely identifies the notification.
- `type` identifies the notification category.
- `emergencyId` is included only when relevant.
- `createdAt` is generated by the backend.
- The `data` object must contain only the information required by the application.
- Notification text should support localisation through the mobile application where appropriate.
- The backend must not expose passwords, access tokens, refresh tokens, FCM tokens, or sensitive patient medical information in notification payloads.

Notification payloads must not be treated as complete emergency records.

When a notification is opened, the mobile application should retrieve the latest authorised emergency information through REST.

## 11.7 Notification Delivery Rules

The backend must apply notification delivery rules based on the underlying operation.

Examples:

### Emergency Request

When a patient successfully creates an emergency request:

- The backend may send an acknowledgement notification to the patient.
- The notification must only be generated after the emergency request has been committed.
- It must not claim that a responder has been assigned unless an assignment has actually occurred.

### Responder Offer

When the dispatch engine creates a responder offer:

- The backend sends an offer notification to the intended responder.
- The notification must reflect the backend-generated offer expiration time.
- The 30-second offer deadline remains authoritative.
- A notification arriving after expiration must not make the offer actionable again.
- The responder must retrieve or validate the current offer before accepting it.

Push delivery latency must not extend the offer expiration deadline.

### Responder Assignment

After successful assignment:

- The backend may notify the patient.
- The assigned responder may receive an assignment confirmation.
- The notification must only be generated after the assignment transaction commits.

### Journey Milestones

The backend may notify authorised recipients about important journey milestones, including:

- `PICKUP_ARRIVED`
- `PATIENT_ONBOARD`
- `IN_TRANSIT`
- `ARRIVED`
- `COMPLETED`

Notifications must reflect committed backend states.

### Dispatch Escalation

When an emergency enters an escalation workflow:

- Authorised dispatch personnel may receive an escalation notification.
- The notification must not expose unnecessary patient medical information.
- The backend must record the escalation independently of whether the notification is delivered.

## 11.8 Background and Offline Behaviour

Mobile applications may be:

- Open and active.
- Running in the background.
- Suspended by the operating system.
- Closed by the user.
- Temporarily disconnected from the internet.

The backend must not assume that a notification was received or displayed.

The following rules apply:

1. Push notifications are best-effort delivery mechanisms.
2. FCM delivery does not guarantee that the user saw or acknowledged the message.
3. The application must retrieve current information when opened.
4. Expired offers must remain expired even if their notifications arrive late.
5. Duplicate notifications must not create duplicate emergency operations.
6. Missed notifications must not prevent a user from recovering the current emergency state through REST.
7. WebSocket and push notification delivery must not independently change backend emergency states.

For time-sensitive offers, the responder must be able to retrieve the current offer status through the active-offers REST endpoint.

## 11.9 Notification Reliability and Retries

The backend should maintain a notification delivery record.

Each record should identify:

- Notification ID.
- Notification category.
- Intended user.
- Target device, where applicable.
- Related emergency, where applicable.
- Creation timestamp.
- Delivery attempt count.
- Last attempt timestamp.
- Current delivery status.
- Relevant FCM response or failure category.

Recommended internal delivery statuses:

- `PENDING`
- `SENT_TO_FCM`
- `FAILED`
- `INVALID_TOKEN`

These are proposed internal statuses, not emergency states.

`SENT_TO_FCM` means FCM accepted the message for processing. It does not prove that the device received or displayed it.

### Retry Rules

- Retry only failures classified as transient.
- Do not retry permanently invalid registration tokens indefinitely.
- Use bounded retry attempts and backoff.
- Do not allow notification retries to change emergency or dispatch deadlines.
- Prevent duplicate notification creation when the same underlying event is processed more than once.
- Record permanent failures for monitoring and operational investigation.

The exact retry count, backoff schedule, and notification retention period will be determined during implementation and operational testing.

## 11.10 Notification Priority and Expiration

FCM message priority and time-to-live settings must reflect the urgency and purpose of each notification.

The backend should distinguish between:

- Time-sensitive responder offer notifications.
- Important emergency journey notifications.
- General account and informational notifications.

### Responder Offers

- Notification delivery should be configured for appropriate time-sensitive handling.
- Notification expiration must not exceed the offer's remaining validity period.
- A notification must not revive an expired offer.
- The backend must validate offer status and expiration before accepting a response.

### Journey Updates

- Important journey notifications may remain useful after a short delivery delay.
- The application must still retrieve the current emergency state before presenting an outdated action as current.

### General Notifications

- Non-urgent notifications may use lower delivery priority.
- Their retention and expiration settings should be appropriate to their purpose.

Actual FCM platform priority settings and time-to-live values must be tested on supported Android and iOS devices before production approval.

## 11.11 Security and Privacy

The notification system must enforce:

- Authenticated device registration.
- Device ownership validation.
- Protected storage and handling of FCM tokens.
- Recipient verification before sending notifications.
- No sensitive medical details in push payloads.
- No exposure of patient information through notification previews beyond approved privacy requirements.
- No direct trust in client-supplied notification data.
- Removal or deactivation of invalid device tokens.
- Auditability of important notification operations.

The mobile application should support privacy-conscious notification previews.

For example, a notification should prefer a generic message such as "Your emergency request has an update" rather than exposing sensitive pregnancy or medical details on a locked screen.

The exact notification preview policy must be agreed with product and privacy stakeholders.

## 11.12 FCM Failure and Operational Resilience

If FCM is unavailable or a delivery attempt fails:

- The underlying emergency operation must remain committed.
- The backend must record the notification failure.
- Transient failures may be retried.
- Invalid device tokens must be deactivated.
- The backend must continue processing emergency and dispatch operations independently of FCM.
- WebSocket delivery may continue when a client has an active connection.
- REST APIs must remain available for authoritative state recovery.

A notification failure must never be treated as proof that a responder declined an offer, that a patient cancelled an emergency, or that an emergency failed.

For critical dispatch workflows, the backend must maintain appropriate operational escalation procedures rather than depending exclusively on push notifications.

## 11.13 Integration with WebSockets

FCM and WebSockets serve different purposes.

| Capability | WebSocket | FCM |
|---|---|---|
| Active application updates | Primary use | Optional |
| Background notifications | Not reliable when disconnected | Primary use |
| Emergency state authority | No | No |
| Authoritative state retrieval | REST required | REST required |
| Reconnection recovery | REST snapshot | REST snapshot |
| Delivery guarantee | No | No |

The backend must avoid treating the same notification and WebSocket event as two separate emergency operations.

Both delivery channels should reference the same underlying committed business event where applicable.

## 11.14 Error Responses

| Error Code | HTTP Status | Meaning |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Authentication is missing or invalid |
| `FORBIDDEN` | 403 | User is not authorised to register or deregister the device |
| `NOT_FOUND` | 404 | Device registration does not exist or is inaccessible |
| `VALIDATION_ERROR` | 422 | Invalid FCM token, platform, or device identifier |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many device registration or deregistration requests |
| `DISPATCH_UNAVAILABLE` | 503 | Required notification or operational dependency is unavailable |

All REST errors must use the standard API error envelope defined in Section 1.

## 11.15 Implementation Boundary

The following requirements are established:

- FCM is the push notification delivery provider.
- The backend controls notification creation and recipient selection.
- Device tokens belong to authenticated user/device associations.
- Users may register multiple devices.
- Invalid tokens must be deactivated.
- Push notifications are not authoritative emergency records.
- The backend database and REST APIs remain authoritative.
- Notification delivery failure must not reverse or block a committed emergency operation.
- The 30-second responder offer timeout remains backend-controlled.
- Notification payloads must not expose unnecessary patient medical information.
- Duplicate notification processing must not create duplicate business operations.

The following require further technical or product agreement:

- Exact notification templates and localisation strategy.
- FCM priority and time-to-live values.
- Retry limits and backoff schedule.
- Notification retention period.
- Notification preferences and user-controlled categories.
- Locked-screen privacy defaults.
- Device registration replacement and multi-account behaviour.
- Operational alerting when critical notifications repeatedly fail.

These decisions must be resolved before the notification system is considered production-ready.

# 12. Administration, Dispatch Operations, and Audit APIs

## 12.1 Purpose

This section defines the administrative and operational APIs used to manage AIDORA, oversee emergencies, coordinate human dispatch intervention, manage responder and healthcare facility eligibility, investigate incidents, handle escalations, and inspect audit records.

All administrative APIs must enforce authentication, role-based permissions, resource scope, validation, and audit requirements.

Administrative privileges must never override emergency lifecycle safety restrictions.

Base path:

`/api/v1/admin`

## 12.2 Administrative Role Model

AIDORA uses independent, non-hierarchical administrative roles with explicitly assigned permissions.

The initial administrative roles are:

- `SUPER_ADMIN`
- `ADMIN`
- `DISPATCH_OPERATOR`
- `VERIFICATION_OFFICER`
- `FACILITY_ADMIN`
- `AUDIT_OFFICER`
- `SUPPORT_OFFICER`

### Role rules

1. Roles do not automatically inherit permissions from other roles.
2. Users may hold multiple authorised roles.
3. Permissions are assigned exclusively through roles.
4. Direct individual permission grants are prohibited.
5. Temporary individual permission exceptions are not supported in the initial architecture.
6. Additional responsibilities require assignment of another authorised role.
7. Role assignments and changes must be audited.
8. Neither `ADMIN` nor `SUPER_ADMIN` receives an unrestricted wildcard permission.
9. No administrative role can bypass emergency state-machine restrictions or patient-safety protections.

## 12.3 Role-to-Permission Matrix

| Permission area | SUPER_ADMIN | ADMIN | DISPATCH_OPERATOR | VERIFICATION_OFFICER | FACILITY_ADMIN | AUDIT_OFFICER | SUPPORT_OFFICER |
|---|---|---|---|---|---|---|---|
| Platform administration | Yes | Limited | No | No | No | No | No |
| Emergency oversight | Yes | Yes | Yes | No | No | Read-only* | Limited* |
| Dispatch intervention | Yes | No | Yes | No | No | No | No |
| Escalation management | Yes | No | Yes | No | No | Read-only* | No |
| Responder verification | Yes | No | No | Yes | No | Read-only* | No |
| Responder suspension | Yes | No | No | Yes | No | No | No |
| Facility management | Yes | Limited | No | No | Scoped | Read-only* | No |
| Audit history | Yes | Limited | No | No | No | Yes | No |

\* Read-only and limited access must be explicitly scoped and permission-controlled.

### Permission enforcement

The backend must:

- Derive the authenticated user from the validated authentication principal.
- Retrieve assigned roles and their associated permissions.
- Verify the permission required for each operation.
- Verify resource scope before granting access.
- Reject unauthorised requests even if the frontend exposes the relevant action.
- Record administrative role and permission changes in the audit history.

A user holding multiple roles receives the combined permissions of those assigned roles, subject to resource scope and all applicable safety restrictions.

## 12.4 Administrative User and Role Management

Administrative user-management operations are restricted to authorised administrators.

Suggested endpoints:

- `GET /admin/users`
- `GET /admin/users/{userId}`
- `GET /admin/users/{userId}/roles`
- `POST /admin/users/{userId}/roles`
- `DELETE /admin/users/{userId}/roles/{roleName}`

### Role assignment

A role assignment request must contain:

- `roleName`
- `reason`

The authenticated administrator is derived from the access token, not supplied by the client.

Role assignment and removal must:

1. Validate that the requested role exists.
2. Verify the acting administrator's permission.
3. Verify any required resource scope.
4. Require step-up authentication where applicable.
5. Enforce two-person approval for administrative role changes.
6. Record the initiating administrator and approving administrator.
7. Record timestamps, reasons, and the resulting role assignment.

A user must not approve their own two-person approval request.

Changes to `SUPER_ADMIN` privileges require two authorised administrators.

## 12.5 Privileged Action Approval Workflow

AIDORA uses risk-based approval requirements.

| Privileged action | Approval requirement |
|---|---|
| View emergency records | One authorised user |
| Assign dispatch intervention | One authorised operator |
| Record operational incident | One authorised user |
| Suspend responder | One authorised verification officer |
| Reinstate responder | Two authorised verification officers |
| Change administrative roles | Two authorised administrators |
| Change SUPER_ADMIN privileges | Two authorised administrators |
| Deactivate facility | One authorised facility administrator |
| Delete or permanently destroy audit history | Prohibited through ordinary APIs |

### Approval rules

1. The initiating user must have permission to initiate the operation.
2. The approving user must have the appropriate independent permission.
3. The initiator cannot approve their own two-person operation.
4. Both initiation and approval must be independently authenticated.
5. Privileged operations requiring step-up authentication must complete that authentication before execution.
6. Rejected requests must record the rejection reason.
7. Expired or rejected approval requests must not execute.
8. Approval records must remain auditable.
9. A successful approval does not override emergency state-machine restrictions.

The backend must enforce approval requirements transactionally so that concurrent approvals cannot cause duplicate execution.

## 12.6 Step-Up Authentication

Sensitive privileged operations require fresh authentication in addition to an ordinary authenticated session.

Operations requiring step-up authentication include:

- Administrative role changes.
- Changes to `SUPER_ADMIN` privileges.
- Responder suspension and reinstatement.
- Healthcare facility deactivation and reactivation.
- Sensitive administrative approvals.
- Particularly sensitive security and audit operations.

### Authentication requirements

1. Prefer phishing-resistant authentication such as WebAuthn/passkeys where supported.
2. Support a properly secured alternative such as time-based one-time passwords (TOTP).
3. Failed step-up authentication must prevent execution.
4. Step-up authentication supplements, rather than replaces, role permissions and two-person approval.
5. Each approver must independently authenticate.
6. Authentication secrets and passwords must never be stored in audit records.
7. Authentication events must be logged securely.

Emergency dispatch intervention must remain immediately available through authorised, securely authenticated dispatch sessions without avoidable patient-safety delays.

## 12.7 Emergency Oversight APIs

Suggested endpoints:

- `GET /admin/emergencies`
- `GET /admin/emergencies/{emergencyId}`
- `GET /admin/emergencies/{emergencyId}/history`
- `GET /admin/emergencies/{emergencyId}/assignments`

These endpoints provide authorised operational visibility into emergencies.

Emergency oversight must preserve:

- Emergency lifecycle history.
- Patient and responder associations.
- Responder assignment history.
- Facility selection history.
- Dispatch attempts and offer outcomes.
- Escalation and incident associations.
- Handover and completion records.

### Restrictions

1. Viewing an emergency does not grant permission to modify it.
2. Administrative users cannot directly overwrite emergency state.
3. Historical emergency events must not be deleted or silently modified.
4. Clinical information must only be accessible through separately authorised clinical workflows.
5. Every administrative access to particularly sensitive emergency information must follow the applicable access-logging policy.

## 12.8 Human Dispatch Intervention APIs

Suggested endpoints:

- `POST /admin/emergencies/{emergencyId}/interventions`
- `GET /admin/emergencies/{emergencyId}/interventions`

Human dispatch intervention is used when automated dispatch cannot safely resolve an operational problem.

### Intervention request

The request must include:

- `interventionType`
- `reason`
- `description`

The authenticated dispatcher is derived from the authentication principal.

The backend generates the intervention ID and timestamp.

### Permitted intervention boundaries

**Before responder acceptance**

Authorised dispatchers may coordinate cancellation, correct dispatch coordination, or initiate another authorised dispatch attempt.

**After acceptance but before patient boarding**

Dispatchers may contact relevant parties, investigate operational problems, and authorise controlled reassignment.

**After `PATIENT_ONBOARD`**

Dispatchers may coordinate safe alternative transportation, contact relevant parties, record incidents, and escalate the situation.

Automatic responder reassignment is prohibited after patient boarding.

The original responder assignment and journey history must remain preserved.

**During transit**

Dispatchers may coordinate destination changes through the appropriate authorised process, considering responder coordination and patient safety.

**After `ARRIVED`**

Dispatchers may coordinate outstanding handover issues. They cannot mark the emergency completed without the required operational handover record.

**After `COMPLETED`**

Operational modification is prohibited. Corrections must use an auditable correction process.

### Intervention safeguards

1. Dispatchers cannot fabricate responder actions, patient consent, arrival, boarding, or handover events.
2. Dispatchers cannot bypass the emergency state machine.
3. Dispatchers cannot directly modify historical journey records.
4. Every intervention records the acting user, timestamp, reason, affected emergency, and action taken.
5. Dispatchers coordinate transportation and do not make clinical decisions or prescribe treatment.
6. Post-boarding intervention must not wait for a second approval where delay could endanger the patient.

## 12.9 Escalation Management APIs

Suggested endpoints:

- `GET /admin/escalations`
- `GET /admin/escalations/{escalationId}`
- `POST /admin/escalations`
- `PATCH /admin/escalations/{escalationId}/acknowledge`
- `PATCH /admin/escalations/{escalationId}/status`
- `POST /admin/escalations/{escalationId}/assign`

### Severity levels

| Severity | Description |
|---|---|
| `CRITICAL` | Immediate patient-safety or emergency-continuity threat |
| `HIGH` | Serious operational disruption requiring urgent intervention |
| `MEDIUM` | Repeated operational problems requiring dispatcher attention |
| `LOW` | Non-urgent discrepancies or coordination problems |

### Escalation triggers

- `CRITICAL`: Immediate patient-safety threat, emergency-continuity threat, or responder unable to continue after patient boarding.
- `HIGH`: Serious disruption, such as an accepted responder becoming unreachable before pickup or repeated dispatch failures.
- `MEDIUM`: Repeated operational problems requiring dispatch attention.
- `LOW`: Non-urgent discrepancies, coordination issues, or monitoring requirements.

### Acknowledgement targets

| Severity | Human acknowledgement target |
|---|---|
| `CRITICAL` | Immediate |
| `HIGH` | Within 2 minutes |
| `MEDIUM` | Within 10 minutes |
| `LOW` | Within 30 minutes |

These are acknowledgement targets, not guaranteed resolution times.

### Escalation statuses

- `OPEN`
- `ACKNOWLEDGED`
- `IN_PROGRESS`
- `RESOLVED`
- `CLOSED`

### Assignment rules

- `CRITICAL`: Notify the on-duty dispatch lead and designated emergency oversight personnel immediately.
- `HIGH`: Assign to an available authorised dispatch operator and notify the dispatch lead.
- `MEDIUM`: Assign to the dispatch operations queue.
- `LOW`: Assign to the appropriate operational review queue.

Every escalation must have an identifiable owner.

If acknowledgement does not occur within the target, the backend must escalate to the next authorised level.

If no operator is available, the escalation remains open and authorised personnel continue to be notified.

### Escalation safeguards

1. The backend owns escalation deadlines and status transitions.
2. Push notification delivery does not determine whether an escalation exists.
3. Notification delays cannot reset acknowledgement deadlines.
4. Severity measures operational risk; status describes workflow progress.
5. Resolved escalations may be reopened when necessary.
6. Closing an escalation does not automatically complete or alter its associated emergency.
7. Critical escalations remain visible until appropriately addressed.
8. Every status change and assignment must be audited.
9. Exact trigger thresholds must be configurable rather than scattered throughout application code.

## 12.10 Responder Verification Administration APIs

Suggested endpoints:

- `GET /admin/responders`
- `GET /admin/responders/{responderId}/verification`
- `GET /admin/responders/{responderId}/evidence`
- `POST /admin/responders/{responderId}/verification/review`
- `POST /admin/responders/{responderId}/suspend`
- `POST /admin/responders/{responderId}/reinstate`

### Verification states

- `PENDING`
- `VERIFIED`
- `UNVERIFIED`
- `SUSPENDED`

Only `VERIFIED` responders may transition to `ONLINE` or receive and accept responder offers.

### Verification evidence categories

Depending on responder type and applicable requirements:

- Government-issued identity evidence.
- Verified phone number and email address.
- Vehicle registration and vehicle details.
- Valid driver's licence.
- Evidence of service eligibility.
- Complete responder profile and required declarations.

Each mandatory evidence item must have an individual review status:

- Accepted.
- Rejected.
- Expired.
- Requires correction.

### Verification rules

1. Rejected evidence requires a reason.
2. Expired mandatory evidence prevents the responder from going online.
3. Verification decisions record the officer, timestamp, and evidence reviewed.
4. Evidence must be protected by appropriate access controls.
5. Operational eligibility verification does not imply medical-professional licensing unless separately verified.
6. Verification history must remain auditable.

### Responder suspension

An authorised verification officer may suspend a responder.

Suspension must:

- Include a reason.
- Record the acting officer.
- Record a backend-generated timestamp.
- Prevent the responder from becoming or remaining eligible for dispatch.
- Preserve existing emergency and assignment history.

Suspension does not erase previous verification records.

### Responder reinstatement

Reinstatement requires:

1. Review of the original suspension reason.
2. Correction of missing, expired, or rejected mandatory evidence.
3. Completion of required investigations.
4. Reassessment of responder eligibility.
5. Initiation by an authorised verification officer.
6. Independent approval by a second authorised verification officer.

The initiating officer cannot approve their own request.

Successful reinstatement changes `SUSPENDED` to `VERIFIED`.

It does not automatically change responder availability to `ONLINE`.

Rejected reinstatement requests must include reasons.

Repeated suspensions must preserve all previous suspension and reinstatement records.

Creating another account must not provide a means to bypass suspension or verification controls.

## 12.11 Healthcare Facility Administration APIs

Suggested endpoints:

- `GET /admin/facilities`
- `GET /admin/facilities/{facilityId}`
- `PATCH /admin/facilities/{facilityId}/status`
- `POST /admin/facilities/{facilityId}/deactivation-requests`
- `POST /admin/facilities/{facilityId}/reactivation-requests`

Facility administrators may manage only facilities within their authorised scope.

### Facility statuses

- `ACTIVE`
- `INACTIVE`
- `SUSPENDED`
- `PENDING_VERIFICATION`

### Status rules

`ACTIVE` facilities are eligible for normal receiving-facility selection, subject to their capabilities and operational information.

`INACTIVE` facilities cannot be selected for new emergencies.

`SUSPENDED` facilities cannot be selected until formally reinstated.

`PENDING_VERIFICATION` facilities cannot be used for normal dispatch.

Every facility status change must record the acting user, reason, and timestamp.

### Facility deactivation

An authorised facility administrator may request deactivation within their permitted facility scope.

The request must contain a reason.

The backend must check:

- Active emergencies associated with the facility.
- Outstanding operational handovers.
- Other relevant operational dependencies.

Deactivation must not silently cancel, redirect, or modify existing emergencies.

Active emergencies require authorised dispatch review before final deactivation.

A facility with unresolved handovers must not be treated as safely deactivated for operational purposes.

Once deactivated, the facility cannot be selected for new emergencies.

Reactivation requires authorised review and an auditable status change.

### Facility suspension and reactivation

Suspension is distinct from ordinary deactivation.

Suspension addresses serious safety, compliance, or operational concerns.

A suspended facility cannot be selected for normal receiving-facility selection until formally reinstated by an authorised actor following appropriate review.

Facility status changes must never erase:

- Facility registration records.
- Facility capabilities.
- Historical emergency associations.
- Handover records.
- Facility status history.

## 12.12 Incident Management APIs

Suggested endpoints:

- `GET /admin/incidents`
- `GET /admin/incidents/{incidentId}`
- `POST /admin/incidents`
- `PATCH /admin/incidents/{incidentId}/status`
- `POST /admin/incidents/{incidentId}/assign`
- `POST /admin/incidents/{incidentId}/investigation-notes`
- `POST /admin/incidents/{incidentId}/reopen`

### Incident categories

- `RESPONDER_INCIDENT`
- `PATIENT_SAFETY_INCIDENT`
- `DISPATCH_INCIDENT`
- `FACILITY_INCIDENT`
- `TECHNICAL_INCIDENT`
- `SECURITY_INCIDENT`
- `DATA_INTEGRITY_INCIDENT`
- `OTHER_INCIDENT`

### Incident creation

Every incident must record:

- Category.
- Description.
- Reporting actor.
- Backend-generated timestamp.
- Associated emergency or entity, where applicable.

An incident may be linked to an escalation, but incident and escalation records remain separate.

Operational incident notes must not contain patient clinical details.

Security and data-integrity incidents require appropriately restricted access.

Incident categories may be extended without modifying historical records.

Creating an incident must not automatically alter emergency state or responder assignment.

### Incident investigation lifecycle

Approved statuses:

- `REPORTED`
- `UNDER_REVIEW`
- `INVESTIGATING`
- `ACTION_REQUIRED`
- `RESOLVED`
- `CLOSED`

### Investigation rules

1. Every accepted incident must have an identifiable owner.
2. Investigation findings and actions must record timestamps and responsible actors.
3. Evidence must be protected against unauthorised modification or deletion.
4. Patient-safety, security, and data-integrity incidents require appropriately authorised review.
5. Closure requires a resolution summary and closure reason.
6. Incidents may be reopened if new evidence emerges or the problem recurs.
7. Closing an incident does not automatically close a linked escalation or complete an emergency.
8. Complete investigation history must be preserved.

## 12.13 Audit History APIs

Suggested endpoints:

- `GET /admin/audit-logs`
- `GET /admin/audit-logs/{auditId}`
- `GET /admin/emergencies/{emergencyId}/audit-logs`
- `GET /admin/responders/{responderId}/audit-logs`
- `GET /admin/facilities/{facilityId}/audit-logs`

Audit access is controlled by explicit role permissions and resource scope.

### Audit events

The audit system must capture relevant events, including:

- Administrative role assignments and removals.
- Privileged approval requests and decisions.
- Step-up authentication events.
- Emergency interventions.
- Emergency assignment and reassignment actions.
- Escalation creation, acknowledgement, assignment, and status changes.
- Responder verification, suspension, and reinstatement.
- Facility status changes, deactivation, and reactivation.
- Incident creation, investigation, resolution, and closure.
- Access to particularly sensitive administrative and operational records.

### Audit record fields

Where applicable, audit records should include:

- Audit record ID.
- Acting user ID.
- Action.
- Resource type.
- Resource ID.
- Previous state.
- New state.
- Reason.
- Timestamp.
- Request or correlation ID.
- Relevant approval references.

Sensitive authentication secrets, passwords, and unnecessary patient clinical information must never be included.

### Audit integrity

1. Audit history must be append-only through ordinary application operations.
2. Ordinary APIs must not expose audit deletion or alteration.
3. Corrections must be recorded as new auditable events.
4. Audit access must itself be logged.
5. Archived records remain subject to role-based access and access logging.

## 12.14 Audit Retention and Archival

AIDORA uses retention schedules based on record category.

The categories include:

- Emergency and journey audit records.
- Security and access logs.
- Administrative and verification records.
- Incident and escalation records.

Exact retention periods must be established against applicable Nigerian legal and regulatory requirements and AIDORA's legal obligations before implementation.

### Archival rules

1. Records reaching the end of their active retention period may be transferred to protected archival storage.
2. Archived records remain protected by role-based permissions.
3. Access to archived records must be logged.
4. Legal holds must prevent deletion and preserve access to affected records.
5. Permanent destruction requires an authorised retention-policy process.
6. Legal review must be obtained where applicable.
7. Destruction decisions and execution must be auditable.
8. Ordinary application APIs must never provide a way to permanently delete audit history.

## 12.15 Security and Privacy Requirements

All administrative APIs must enforce:

- Valid authentication.
- Role-based permission checks.
- Resource-level access scope.
- Input validation.
- Appropriate rate limiting.
- Secure error responses.
- Audit logging.
- Protection of sensitive operational and identity information.

Additional requirements:

1. Administrative endpoints must never trust user IDs, actor IDs, timestamps, or approval identities supplied by the client when these can be derived or generated by the backend.
2. Backend timestamps are authoritative.
3. Sensitive evidence documents must be stored and retrieved through authorised, protected mechanisms.
4. Security and data-integrity incidents require restricted visibility.
5. Administrative access must not expose unnecessary patient clinical information.
6. Step-up authentication and approval requirements must be enforced server-side.
7. Authentication and authorisation failures must not disclose sensitive account or resource information.

## 12.16 Transaction Integrity and Concurrency

Privileged operations that affect operational state must use database transactions.

The backend must guarantee:

- Approval and execution cannot be separated in a way that permits unauthorised execution.
- Two-person approvals cannot be duplicated or self-approved.
- Concurrent administrative requests cannot produce inconsistent role or verification states.
- Facility deactivation cannot bypass active-emergency and unresolved-handover checks.
- Incident and escalation history remains consistent.
- Audit records are committed with their corresponding successful state changes where required.

Where notification delivery is needed, the operational database transaction must not depend on successful push delivery.

A transactional outbox may be used to deliver notifications reliably after the relevant database transaction commits.

## 12.17 Standard Error Responses

Administrative APIs use the standard AIDORA error envelope.

Example:

`403 Forbidden`

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action.",
    "details": {}
  }
}
```

Relevant error codes include:

- `UNAUTHENTICATED`
- `PERMISSION_DENIED`
- `RESOURCE_NOT_FOUND`
- `VALIDATION_ERROR`
- `APPROVAL_REQUIRED`
- `APPROVAL_REJECTED`
- `STEP_UP_AUTHENTICATION_REQUIRED`
- `STEP_UP_AUTHENTICATION_FAILED`
- `INVALID_STATE_TRANSITION`
- `ACTIVE_EMERGENCIES_EXIST`
- `UNRESOLVED_HANDOVER_EXISTS`
- `VERIFICATION_REQUIRED`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `SERVICE_UNAVAILABLE`

The backend must use appropriate HTTP status codes and must not expose internal stack traces, credentials, or sensitive operational data.

## 12.18 Architecture and Safety Boundaries

The following rules apply across all administrative and operational APIs:

1. The backend remains authoritative for emergency state, assignment, deadlines, and permissions.
2. Administrative permissions never override the emergency state machine.
3. Automatic responder reassignment is forbidden after `PATIENT_ONBOARD`.
4. Human intervention after boarding must preserve the original responder assignment and journey history.
5. Facility arrival does not complete an emergency; explicit operational handover is required.
6. Facility handover records remain immutable.
7. Only `VERIFIED` responders may become `ONLINE` or receive and accept offers.
8. Push notifications are not authoritative operational records.
9. Incident, escalation, emergency, and audit histories remain distinct but may be linked.
10. Audit history cannot be deleted through ordinary APIs.
11. Two-person approval and step-up authentication requirements must be enforced by the backend.
12. Patient safety takes precedence over administrative convenience or ordinary approval delays.

## 12.19 Implementation Notes and Outstanding Clarifications

The approved architecture decisions define the initial administrative contract.

The following details require implementation-level specification or external confirmation before production:

- Exact Nigerian legal and regulatory audit-retention periods.
- Applicable responder evidence requirements for each responder category.
- Exact resource-scope rules for limited administrative and read-only roles.
- Exact facility reactivation authority and approval workflow.
- Exact incident and escalation trigger thresholds and configuration values.
- Detailed step-up authentication session validity and recovery procedures.
- Final permission identifiers and their mapping to the approved permission matrix.
- Exact API payload schemas and response examples for each endpoint.

These details must be resolved without contradicting the approved architecture decisions or existing API contracts.