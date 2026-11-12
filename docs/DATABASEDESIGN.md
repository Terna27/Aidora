
# Agreed decisions:

- Backend: Go.
- Database: PostgreSQL with PostGIS.
- Architecture: Modular monolith.
- Router: Chi.
- Database access: pgx and sqlc.
- Migrations: Goose.
- Working branch: `backend`.
- Backend directory: `apps/backend/`.

The first implementation deliverable is the database design (ERD). It determines how AIDORA stores patients, responders, emergencies, assignments, offers, facilities, and emergency history.

# Stage 1 — Database design

## 1. The entities we need

We'll begin with these core entities:

| Entity                    | Responsibility                               |
| ------------------------- | -------------------------------------------- |
| `users`                   | Authentication identity and account role     |
| `patient_profiles`        | Patient-specific information                 |
| `responder_profiles`      | Responder and vehicle information            |
| `facilities`              | Healthcare facility information              |
| `emergencies`             | Emergency request and current state          |
| `emergency_state_history` | Record of every state transition             |
| `responder_offers`        | Dispatch offers sent to responders           |
| `emergency_assignments`   | Current and historical responder assignments |
| `facility_selections`     | Facility selected for an emergency           |
| `emergency_contacts`      | Patient emergency contacts                   |

One important design choice: authentication identity and user profiles will be separate. This allows patients and responders to share authentication infrastructure without forcing their profile information into one large table.

## 2. Proposed entity relationships

Here is the first ERD. It is a design model, not executable SQL yet.

\#chatgpt-mermaid-\_r_227\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_227\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_227\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_227\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_227\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_227\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_227\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_227\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_227\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_227\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_227\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_227\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_227\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_227\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_227\_ p{margin:0;}#chatgpt-mermaid-\_r_227\_ .entityBox{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_227\_ .relationshipLabelBox{fill:rgb(48, 48, 48);opacity:0.7;background-color:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_227\_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-\_r_227\_ .labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_227\_ .edgeLabel{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_227\_ .edgeLabel .label rect{fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_227\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_227\_ .edgeLabel .label{fill:rgb(31, 78, 148);font-size:14px;}#chatgpt-mermaid-\_r_227\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_227\_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-\_r_227\_ .node rect,#chatgpt-mermaid-\_r_227\_ .node circle,#chatgpt-mermaid-\_r_227\_ .node ellipse,#chatgpt-mermaid-\_r_227\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_227\_ .relationshipLine{stroke:rgb(175, 175, 175);stroke-width:1px;fill:none;}#chatgpt-mermaid-\_r_227\_ .marker{fill:none!important;stroke:rgb(175, 175, 175)!important;stroke-width:1;}#chatgpt-mermaid-\_r_227\_ [data-look=neo].labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_227\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_227\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_227\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_227\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_227\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_227\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_227\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_227\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_227\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_227\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}USERSuuididPKstringphone_numberUKstringpassword_hashstringroledatetimecreated_atdatetimeupdated_atPATIENT_PROFILESuuididPKuuiduser_idFKstringfull_namestringcommunity_or_villageintgestational_age_weeksstringblood_grouptextallergies_or_notesRESPONDER_PROFILESuuididPKuuiduser_idFKstringfull_namestringvehicle_typestringvehicle_make_modelstringlicense_platestringverification_statusstringavailability_statusstringcommunity_baseEMERGENCY_CONTACTSuuididPKuuidpatient_idFKstringfull_namestringphone_numberstringrelationshipEMERGENCIESuuididPKuuidpatient_idFKstringcurrent_statestringlocation_sourcegeographypickup_locationstringvillage_or_communitystringlandmarktextdirections_notestextpatient_notesdatetimecreated_atdatetimeupdated_atEMERGENCY_STATE_HISTORYuuididPKuuidemergency_idFKstringprevious_statestringnew_stateuuidactor_user_idFKstringactor_typetextreasondatetimeoccurred_atRESPONDER_OFFERSuuididPKuuidemergency_idFKuuidresponder_idFKstringstatusdatetimeoffered_atdatetimeexpires_atdatetimeresponded_atEMERGENCY_ASSIGNMENTSuuididPKuuidemergency_idFKuuidresponder_idFKstringassignment_statusdatetimeassigned_atdatetimeended_attextend_reasonFACILITY_SELECTIONSuuididPKuuidemergency_idFKuuidfacility_idFKuuidselected_byFKdatetimeselected_atFACILITIESuuididPKstringnamestringaddressstringphone_numberstringcapability_statusgeographylocationhashasownscreatesrecordsreceivesreceiveshasfulfilshasselected_for

## 3. Important database decisions

These are not merely table-design details. They protect the reliability of the emergency workflow.

### A. Emergency state and state history are separate

The `emergencies` table stores the current state.

The `emergency_state_history` table records how the emergency reached that state.

For example:

| Emergency | Previous state | New state       |
| --------- | -------------- | --------------- |
| E001      | NULL           | CREATED         |
| E001      | CREATED        | DISPATCHING     |
| E001      | DISPATCHING    | ACCEPTED        |
| E001      | ACCEPTED       | PICKUP_ARRIVED  |
| E001      | PICKUP_ARRIVED | PATIENT_ONBOARD |

If the current state is `PATIENT_ONBOARD`, the history still tells us every transition that happened before it.

We must never update the current state without recording its corresponding history entry in the same database transaction.

### B. Assignments and offers are different

An offer means:

> A responder has been invited to take an emergency.

An assignment means:

> A responder has actually accepted responsibility for that emergency.

We need both tables because several responders may receive offers, but only one can own the active assignment.

The database must enforce that there cannot be two simultaneous active assignments for the same emergency.

### C. Location must preserve its source

For an emergency location:

- GPS location: store coordinates and the location source.
- Manual location: store the description, landmark, and directions.
- Manual location must not receive invented coordinates.

PostGIS will allow us to perform distance-based facility and responder searches later.

### D. Historical records must remain available

When a responder withdraws and another responder takes over, we must not overwrite the old assignment.

The old assignment gets an ending timestamp and reason. A new assignment is created.

That gives us an auditable record of who was responsible at each point in time.

## 4. Constraints we must enforce

Before writing SQL migrations, these are the important database rules we'll implement:

| Rule                                                   | Enforcement                               |
| ------------------------------------------------------ | ----------------------------------------- |
| Phone numbers must be unique                           | Unique constraint on `users.phone_number` |
| Each user has at most one patient profile              | Unique foreign key                        |
| Each user has at most one responder profile            | Unique foreign key                        |
| An emergency must reference an existing patient        | Foreign key                               |
| Manual location cannot contain GPS coordinates         | Database check constraint                 |
| One emergency cannot have two active assignments       | Partial unique index                      |
| One responder cannot have two active journeys          | Partial unique index                      |
| An offer cannot be accepted after expiry               | Transactional application check           |
| Emergency history must reference an existing emergency | Foreign key                               |
| Facility selection must reference an existing facility | Foreign key                               |

Some rules, such as valid state transitions, need application-level validation inside Go transactions as well as appropriate database constraints.

## 5. How we'll implement this in Go

We will follow this order:

1. Finalize the ERD

   Confirm entities, relationships, and constraints.
2. Create the Go module

   Establish `apps/backend/go.mod` and the application entry point.
3. Set up PostgreSQL and PostGIS

   Configure database connectivity in Codespaces.
4. Create Goose migrations

   Translate the approved ERD into SQL tables, indexes, and constraints.
5. Configure sqlc and pgx

   Generate type-safe Go database access code.
6. Implement the emergency domain

   Implement state-transition validation and transactional updates.
7. Write and run tests

   Test valid transitions, invalid transitions, concurrent responder acceptance, and recovery scenarios.

## 6. Two design refinements before we write migrations

There are two decisions I want us to make carefully:

1\. Facility capabilities: A facility may support maternity care, emergency obstetric care, blood transfusion, or other services. I recommend a separate `facility_capabilities` table rather than storing a list of capabilities in one text field.

2\. Responder assignment: I recommend treating `emergency_assignments` as the authoritative source of the assigned responder. We should not maintain a second independent `assigned_responder_id` on `emergencies`, because those two values could disagree.
