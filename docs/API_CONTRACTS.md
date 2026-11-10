# RideRoute Backend API Contracts & Integration Guide

**Platform:** RideRoute (Maternal Emergency Transportation Coordination)  
**Author:** Developer 1 (Frontend & Mobile Architect)  
**Audience:** Developer 2 (Python Backend, Dispatch Engine & Realtime Infrastructure)  
**Protocol:** RESTful JSON (HTTP/HTTPS) + WebSocket for Real-time Dispatch Updates  
**Domain Boundary:** RideRoute coordinates non-emergency and emergency transportation by verified commercial drivers (motorcycle & taxi). Ordinary drivers are **never** represented as paramedics, doctors, or medical professionals.

---

## 1. Standard API Envelope & Error Format

All responses must adhere to the standard envelope:

### Success Response:
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "ACTIVE_EMERGENCY_EXISTS",
    "message": "You already have an active emergency request in progress.",
    "details": {
      "activeEmergencyId": "em-894721",
      "status": "DISPATCHING"
    }
  }
}
```

### Standard Error Codes:
- `ACTIVE_EMERGENCY_EXISTS` (409 Conflict): Attempted to submit a new emergency while one is active.
- `CANCELLATION_FORBIDDEN` (400 Bad Request): Attempted to cancel after `PATIENT_ONBOARD`.
- `MISSING_LOCATION` (400 Bad Request): Location has neither GPS nor community/landmark.
- `INVALID_PHONE` (400 Bad Request): Phone number format is invalid or under 8 digits.
- `UNAUTHENTICATED` (401 Unauthorized): Missing or expired JWT token.
- `NOT_FOUND` (404 Not Found): Resource ID does not exist.
- `DISPATCH_UNAVAILABLE` (503 Service Unavailable): Dispatch engine temporary outage.

---

## 2. Agreed Emergency State Machine & Classification

```text
CREATED → DISPATCHING → ACCEPTED → PICKUP_ARRIVED → PATIENT_ONBOARD → (HOSPITAL_SELECTED) → IN_TRANSIT → ARRIVED → COMPLETED
```

### State Classification & Domain Authority:
1. **Backend-Authoritative States (Core Transportation Workflow):**
   - `CREATED`: Request submitted by patient; validated by Python backend.
   - `DISPATCHING`: Dispatch engine broadcasting offer to eligible verified drivers within sector.
   - `ACCEPTED`: A verified driver has accepted the assignment and is navigating to the patient pickup location.
   - `PICKUP_ARRIVED`: Driver has arrived at the patient's community or pickup landmark.
   - `PATIENT_ONBOARD`: Expectant mother has safely boarded the vehicle. (Emergency cancellation is strictly locked out beyond this point).
   - `IN_TRANSIT`: Vehicle is en route to designated healthcare facility.
   - `ARRIVED`: Vehicle has arrived at healthcare facility entrance. **`ARRIVED` does not automatically mean `COMPLETED`**.
   - `COMPLETED`: Patient has been safely transferred to an authorized facility representative via explicit operational handover (`completeHandover`).

2. **Optional State:**
   - `HOSPITAL_SELECTED`: Optional milestone if facility destination is assigned or modified dynamically en route. If facility is fixed at request time, the journey transitions directly from `PATIENT_ONBOARD` to `IN_TRANSIT`.

3. **Presentational (Client Display Only):**
   - `HEADING_TO_PICKUP`: Presentational label displayed in the mobile client while backend state is `ACCEPTED`. The client must **never** send `HEADING_TO_PICKUP` as a backend state transition target.

### Exception & Terminal States:
- `CANCELLED`: Permitted only while in `CREATED`, `DISPATCHING`, `ACCEPTED`, or `PICKUP_ARRIVED`. Forbidden after `PATIENT_ONBOARD`.
- `EXPIRED`: No responder accepted within the timeout window (triggers escalation / emergency hotline advice).
- `ESCALATED`: Auto-dispatch failed; transferred to human dispatch desk.
- `REASSIGNING`: Previous responder was forced to drop out (e.g., breakdown); re-alerting drivers.
- `FAILED_CONTACT`: Patient or responder unreachable after acceptance.

---

## 3. REST API Endpoints Specification

### A. Authentication & Session

#### `POST /api/v1/auth/register`
Creates a patient account.

**Request Payload:**
```json
{
  "fullName": "Fatima Bello",
  "phoneNumber": "08012345678",
  "password": "optionalSecurePassword",
  "communityOrVillage": "Karu Village",
  "emergencyContactName": "Amina Bello",
  "emergencyContactPhone": "08098765432",
  "emergencyContactRelationship": "Sister"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_string",
    "patient": {
      "id": "pat-1001",
      "fullName": "Fatima Bello",
      "phoneNumber": "08012345678",
      "role": "PATIENT",
      "communityOrVillage": "Karu Village",
      "emergencyContacts": [
        {
          "id": "con-1",
          "name": "Amina Bello",
          "phoneNumber": "08098765432",
          "relationship": "Sister",
          "isPrimary": true
        }
      ],
      "createdAt": "2026-11-10T00:00:00Z",
      "updatedAt": "2026-11-10T00:00:00Z"
    }
  }
}
```

#### `POST /api/v1/auth/login`
Authenticates a patient by mobile phone.

**Request Payload:**
```json
{
  "phoneNumber": "08012345678",
  "password": "optionalPassword"
}
```

#### `POST /api/v1/auth/forgot-password`
Initiates SMS-based OTP password recovery.

---

### B. Patient Profile & Emergency Contacts

#### `GET /api/v1/patient/profile`
Header: `Authorization: Bearer <token>`
Returns full patient profile.

#### `PUT /api/v1/patient/profile`
Updates patient details (gestational age, blood group, medical notes).

**Request Payload:**
```json
{
  "fullName": "Fatima Bello",
  "phoneNumber": "08012345678",
  "communityOrVillage": "Karu Village, Zone 4",
  "gestationalAgeWeeks": 34,
  "bloodGroup": "O+",
  "allergiesOrNotes": "Hypertensive monitoring"
}
```

#### `POST /api/v1/patient/emergency-contacts`
Adds an emergency contact.

**Request Payload:**
```json
{
  "name": "Musa Bello",
  "phoneNumber": "08033334444",
  "relationship": "Husband",
  "isPrimary": false
}
```

#### `DELETE /api/v1/patient/emergency-contacts/{id}`
Deletes an emergency contact.

---

### C. Emergency Transportation Lifecycle

#### `POST /api/v1/emergencies`
Triggers an emergency ride dispatch request.

**Request Payload:**
```json
{
  "patientId": "pat-1001",
  "location": {
    "source": "GPS", // "GPS" | "MANUAL"
    "coords": {
      "latitude": 9.0765,
      "longitude": 7.3986
    },
    "accuracyMeters": 12,
    "accuracyLevel": "HIGH", // "HIGH" | "MEDIUM" | "LOW" | "APPROXIMATE"
    "villageCommunity": "Karu Village",
    "landmark": "Near Mosque Water Pump",
    "streetAddress": "House 12",
    "directionsNotes": "Call when at junction"
  },
  "notes": "Gestational age: 34 weeks"
}
```

**Safety Invariant on Location:**
- If `source === "MANUAL"`, `coords` **must be omitted or null**. The Python backend must never fabricate coordinates.

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "id": "em-894721",
    "patientId": "pat-1001",
    "patientName": "Fatima Bello",
    "patientPhone": "08012345678",
    "status": "DISPATCHING",
    "location": { ... },
    "createdAt": "2026-11-10T00:15:00Z",
    "updatedAt": "2026-11-10T00:15:00Z",
    "history": [
      {
        "state": "CREATED",
        "timestamp": "2026-11-10T00:15:00Z",
        "note": "Request received by system"
      },
      {
        "state": "DISPATCHING",
        "timestamp": "2026-11-10T00:15:01Z",
        "note": "Alerting verified drivers in vicinity"
      }
    ]
  }
}
```

#### `GET /api/v1/emergencies/active`
Returns the currently ongoing emergency for the authenticated patient, or `null`.

When in state `ACCEPTED` or later, must include the `assignedResponder`:
```json
"assignedResponder": {
  "id": "resp-201",
  "fullName": "Ibrahim Suleiman",
  "phoneNumber": "+2348031112233",
  "roleDescription": "Verified Transportation Responder",
  "vehicleType": "MOTORCYCLE", // "MOTORCYCLE" | "TAXI"
  "vehicleModel": "Bajaj Boxer 150 (Black)",
  "licensePlate": "KJA-482-XA",
  "rating": 4.9,
  "etaMinutes": 6
}
```

#### `POST /api/v1/emergencies/{id}/cancel`
Cancels the emergency before the patient is onboard.
If the emergency is already in `PATIENT_ONBOARD`, `IN_TRANSIT`, `ARRIVED`, or `COMPLETED`, returns HTTP 400 `CANCELLATION_FORBIDDEN`.

**Request Payload:**
```json
{
  "reason": "Family arranged private transport"
}
```

#### `POST /api/v1/emergencies/{id}/dismiss`
Acknowledges conclusion of a completed, expired, or cancelled emergency, archiving the active session on the client.

#### `GET /api/v1/emergencies/history`
Returns paginated list of previous completed and cancelled emergency requests.

---

## 4. Real-time WebSocket Protocol

Endpoint: `wss://<host>/api/v1/ws/emergencies/{id}?token=<jwt>`

### Outbound Events from Python Backend to Client:

1. **State Changed:**
```json
{
  "event": "emergency.state_changed",
  "data": {
    "emergencyId": "em-894721",
    "state": "ACCEPTED",
    "timestamp": "2026-11-10T00:16:30Z",
    "note": "A verified transportation responder has accepted and is heading to you."
  }
}
```

2. **Responder Assigned:**
```json
{
  "event": "emergency.responder_assigned",
  "data": {
    "emergencyId": "em-894721",
    "responder": {
      "id": "resp-201",
      "fullName": "Ibrahim Suleiman",
      "phoneNumber": "+2348031112233",
      "roleDescription": "Verified Transportation Responder",
      "vehicleType": "MOTORCYCLE",
      "vehicleModel": "Bajaj Boxer 150 (Black)",
      "licensePlate": "KJA-482-XA",
      "etaMinutes": 6
    }
  }
}
```

3. **Responder Location & ETA Update:**
```json
{
  "event": "emergency.responder_location",
  "data": {
    "emergencyId": "em-894721",
    "coords": {
      "latitude": 9.0772,
      "longitude": 7.3991
    },
    "etaMinutes": 4
  }
}
```

4. **Destination Facility Confirmed:**
```json
{
  "event": "emergency.facility_selected",
  "data": {
    "emergencyId": "em-894721",
    "facility": {
      "id": "fac-301",
      "name": "General Hospital Maternal Emergency Center",
      "address": "Hospital Road, Sector 3",
      "community": "Karu Central",
      "emergencyPhone": "+2348004677482"
    }
  }
}
```

---

## 5. Responder Mobile Endpoints (Commercial Drivers & Riders)

Ordinary drivers and motorcycle riders coordinate maternal emergency transport. They must **never** be identified as doctors, nurses, or paramedics.

### 5.1 Responder Registration & Auth
- **`POST /api/v1/responder/auth/register`**
  - **Body:** `{ fullName, phoneNumber, password, vehicleType: 'MOTORCYCLE' | 'TAXI', vehicleMakeModel, licensePlate, vehicleColor, driverLicenseNumber, communityBase, agreedToTerms: true }`
  - **Rules:** Registration requires `agreedToTerms: true` acknowledging transportation role (not medical care). Default status is `verificationStatus: "PENDING"`.
- **`POST /api/v1/responder/auth/login`**
  - **Body:** `{ phoneNumber, password }`
  - **Returns:** `{ token, responder: ResponderProfile }`

### 5.2 Availability & Online Status
- **`POST /api/v1/responder/availability`**
  - **Headers:** `Authorization: Bearer <token>`
  - **Body:** `{ status: "ONLINE" | "OFFLINE" }`
  - **Guards:** Must return `403 Forbidden` (`VERIFICATION_REQUIRED`) if `verificationStatus !== "VERIFIED"`.

### 5.3 Emergency Dispatch Offers
- **`GET /api/v1/responder/offers/active`**
  - **Returns:** Active pending offer with 45-second timeout window, pickup landmark, estimated distance, and designated facility.
- **`POST /api/v1/responder/offers/:offerId/accept`**
  - **Guards:** Rejects if expired (`OFFER_EXPIRED`), already accepted by another driver (`OFFER_UNAVAILABLE`), or if responder has an active journey (`ACTIVE_JOURNEY_EXISTS`).
  - **Returns:** Updated `EmergencyRequest` with status `ACCEPTED`.
- **`POST /api/v1/responder/offers/:offerId/decline`**
  - **Body:** `{ reason?: string }`
  - **Returns:** Clears offer and restores responder to available `ONLINE` state.

### 5.4 Active Journey Milestone Progression
- **`GET /api/v1/responder/journey/active`**
  - **Headers:** `Authorization: Bearer <token>`
  - **Returns:** Active ongoing `EmergencyRequest` or `null`. Used for app launch state restoration and crash recovery.
- **`POST /api/v1/responder/journey/:emergencyId/milestone`**
  - **Headers:** `Authorization: Bearer <token>`
  - **Body:** `{ targetState: 'PICKUP_ARRIVED' | 'PATIENT_ONBOARD' | 'HOSPITAL_SELECTED' | 'IN_TRANSIT' | 'ARRIVED', notes?: string }`
  - **Guards:**
    - Validates sequential progression strictly against the state machine.
    - Rejects invalid jumps with `400 Bad Request` (`INVALID_STATE_TRANSITION`).
    - Attempting to pass `targetState: "COMPLETED"` is **strictly forbidden** and returns `400 Bad Request` (`INVALID_STATE_TRANSITION` / `HANDOVER_REQUIRED`). Completion requires explicit facility reception handover.
- **`POST /api/v1/responder/journey/:emergencyId/handover`**
  - **Headers:** `Authorization: Bearer <token>`
  - **Body:** `{ handoverNotes?: string, receivingStaffName?: string, receivingStaffRole?: string }`
  - **Domain Boundary:** Commercial drivers confirm physical arrival and safe transfer of the expectant mother to an authorized facility representative. Drivers **never** record medical triage, clinical diagnosis, or obstetric examinations.
  - **Guards:** Permitted ONLY when emergency state is `ARRIVED`. Rejects premature completion with `400 Bad Request` (`INVALID_STATE_TRANSITION`).
  - **Returns:** Emergency marked `COMPLETED` and increments responder's completed trip statistics.

### 5.5 Driver Document Verification & Compliance
- **`POST /api/v1/responder/documents`**
  - **Headers:** `Authorization: Bearer <token>`
  - **Body (Multipart/Form-Data or JSON with pre-signed URL):**
    ```json
    {
      "documentType": "DRIVERS_LICENSE", // "DRIVERS_LICENSE" | "VEHICLE_INSURANCE" | "ROADWORTHINESS" | "COMMUNITY_VERIFICATION"
      "documentNumber": "DL-ABJ-498210",
      "expiryDate": "2028-12-31",
      "fileUrl": "https://storage.provider.com/docs/dl-498210.pdf"
    }
    ```
  - **Lifecycle:** Review status managed by admin dispatch (`PENDING` -> `VERIFIED` | `SUSPENDED`).

### 5.6 Device Push Notification Registration
- **`POST /api/v1/responder/devices/push-token`**
  - **Headers:** `Authorization: Bearer <token>`
  - **Body:**
    ```json
    {
      "devicePushToken": "ExponentPushToken[xxxxxxxxxxxxxx]",
      "platform": "ANDROID", // "ANDROID" | "IOS" | "WEB"
      "appVersion": "1.0.0"
    }
    ```
  - **Description:** Registers high-priority notification channels for wake-on-offer background alerts.

### 5.7 Responder Real-Time WebSocket Protocol & Reconnection
- **Endpoint:** `wss://<host>/api/v1/ws/responder?token=<jwt>`
- **Handshake Authentication:** Authenticated via JWT bearer in query string `?token=...` or standard `Authorization` header during HTTP upgrade.
- **Heartbeat & Keep-Alive:** Client and server exchange `{ "type": "ping" }` / `{ "type": "pong" }` every 25 seconds.
- **Missed Events Replay & Sequence Recovery:**
  - Upon reconnection, client sends:
    ```json
    {
      "action": "resume",
      "lastEventSequence": 42,
      "lastEventTimestamp": "2026-11-10T14:22:00Z"
    }
    ```
  - Server replays any missed dispatch offers, active journey updates, or reassignments occurring during temporary disconnection.

### 5.8 Concurrent Offer Acceptance & Expiry Resolution
- When an emergency offer is broadcast to multiple drivers in a sector:
  - Acceptance is an atomic backend transaction.
  - First driver to confirm receives `200 OK` with the assigned `EmergencyRequest`.
  - Subsequent or concurrent acceptances receive `409 Conflict` with error code `OFFER_UNAVAILABLE` (`"Another verified driver in your sector has accepted this emergency request"`).
  - If the countdown window elapses prior to receipt, backend returns `409 Conflict` with `OFFER_EXPIRED`.

### 5.9 Responder Service Statistics Contract
- **`GET /api/v1/responder/stats`**
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:**
    ```json
    {
      "success": true,
      "data": {
        "completedTripsToday": 3,
        "totalCompletedTrips": 50,
        "averageRating": 4.9,
        "hoursOnlineToday": 4.5,
        "acceptanceRatePercent": 96
      }
    }
    ```
  - All statistics are computed authoritatively by the Python backend dispatch engine. During development, client interfaces label this as simulated development data until production database sync.

