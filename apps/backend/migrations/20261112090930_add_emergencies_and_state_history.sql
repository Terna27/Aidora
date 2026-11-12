-- +goose Up

CREATE TABLE emergencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    current_state VARCHAR(30) NOT NULL
        CHECK (current_state IN (
            'CREATED',
            'DISPATCHING',
            'ACCEPTED',
            'PICKUP_ARRIVED',
            'PATIENT_ONBOARD',
            'HOSPITAL_SELECTED',
            'IN_TRANSIT',
            'ARRIVED',
            'COMPLETED',
            'EXPIRED',
            'ESCALATED',
            'REASSIGNING',
            'FAILED_CONTACT',
            'CANCELLED'
        )),

    location_source VARCHAR(10) NOT NULL
        CHECK (location_source IN ('GPS', 'MANUAL')),

    location GEOGRAPHY(POINT, 4326),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy_meters DOUBLE PRECISION
        CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
    accuracy_level VARCHAR(20),

    village_community VARCHAR(150),
    landmark TEXT,
    street_address TEXT,
    directions_notes TEXT,
    patient_notes TEXT,

    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID
        REFERENCES users(id) ON DELETE RESTRICT,
    cancellation_reason TEXT,

    dismissed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT emergencies_location_consistency_check
        CHECK (
            (
                location_source = 'GPS'
                AND location IS NOT NULL
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND latitude BETWEEN -90 AND 90
                AND longitude BETWEEN -180 AND 180
                AND ABS(ST_X(location::geometry) - longitude) < 0.000000001
                AND ABS(ST_Y(location::geometry) - latitude) < 0.000000001
            )
            OR
            (
                location_source = 'MANUAL'
                AND location IS NULL
                AND latitude IS NULL
                AND longitude IS NULL
                AND accuracy_meters IS NULL
                AND accuracy_level IS NULL
            )
        )
);
-- Find a patient's emergency history efficiently.
CREATE INDEX emergencies_patient_created_at_idx
ON emergencies(patient_id, created_at DESC);

-- Find emergencies by lifecycle state.
CREATE INDEX emergencies_current_state_idx
ON emergencies(current_state);

-- Support geographic searches.
CREATE INDEX emergencies_location_idx
ON emergencies USING GIST(location);

-- Prevent a patient from having multiple active emergencies.
CREATE UNIQUE INDEX emergencies_one_active_per_patient_idx
ON emergencies(patient_id)
WHERE current_state NOT IN ('COMPLETED', 'CANCELLED');


CREATE TABLE emergency_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    emergency_id UUID NOT NULL
        REFERENCES emergencies(id) ON DELETE RESTRICT,

    previous_state VARCHAR(30),
    new_state VARCHAR(30) NOT NULL
        CHECK (new_state IN (
            'CREATED',
            'DISPATCHING',
            'ACCEPTED',
            'PICKUP_ARRIVED',
            'PATIENT_ONBOARD',
            'HOSPITAL_SELECTED',
            'IN_TRANSIT',
            'ARRIVED',
            'COMPLETED',
            'EXPIRED',
            'ESCALATED',
            'REASSIGNING',
            'FAILED_CONTACT',
            'CANCELLED'
        )),

    actor_type VARCHAR(30) NOT NULL,

    actor_user_id UUID
        REFERENCES users(id) ON DELETE RESTRICT,

    reason TEXT,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT emergency_history_previous_state_check
        CHECK (
            previous_state IS NULL
            OR previous_state IN (
                'CREATED',
                'DISPATCHING',
                'ACCEPTED',
                'PICKUP_ARRIVED',
                'PATIENT_ONBOARD',
                'HOSPITAL_SELECTED',
                'IN_TRANSIT',
                'ARRIVED',
                'COMPLETED',
                'EXPIRED',
                'ESCALATED',
                'REASSIGNING',
                'FAILED_CONTACT',
                'CANCELLED'
            )
        ),

    CONSTRAINT emergency_history_initial_state_check
        CHECK (
            previous_state IS NOT NULL
            OR new_state = 'CREATED'
        )
);

CREATE INDEX emergency_state_history_emergency_time_idx
ON emergency_state_history(emergency_id, occurred_at);

CREATE INDEX emergency_state_history_actor_time_idx
ON emergency_state_history(actor_user_id, occurred_at);

-- +goose Down
DROP TABLE IF EXISTS emergency_state_history;
DROP TABLE IF EXISTS emergencies;