-- +goose Up

-- 1. Add selected facility information to emergencies.
ALTER TABLE emergencies
ADD COLUMN selected_facility_id UUID
    REFERENCES facilities(id) ON DELETE RESTRICT,
ADD COLUMN facility_selected_at TIMESTAMPTZ,
ADD COLUMN facility_selected_by UUID
    REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE emergencies
ADD CONSTRAINT emergencies_facility_selection_consistency
CHECK (
    (
        selected_facility_id IS NULL
        AND facility_selected_at IS NULL
        AND facility_selected_by IS NULL
    )
    OR
    (
        selected_facility_id IS NOT NULL
        AND facility_selected_at IS NOT NULL
        AND facility_selected_by IS NOT NULL
    )
);

-- 2. Support composite foreign keys for location ownership.
ALTER TABLE emergencies
ADD CONSTRAINT emergencies_id_patient_id_unique
UNIQUE (id, patient_id);

-- 3. Preserve responder assignment history.
CREATE TABLE emergency_responder_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    emergency_id UUID NOT NULL
        REFERENCES emergencies(id) ON DELETE RESTRICT,

    responder_id UUID NOT NULL
        REFERENCES responder_profiles(user_id) ON DELETE RESTRICT,

    assigned_by UUID
        REFERENCES users(id) ON DELETE RESTRICT,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    ended_at TIMESTAMPTZ,

    ended_by UUID
        REFERENCES users(id) ON DELETE RESTRICT,

    end_reason TEXT,

    CONSTRAINT emergency_responder_assignment_end_check
    CHECK (ended_at IS NULL OR ended_at >= assigned_at),

    CONSTRAINT emergency_responder_assignment_end_metadata_check
    CHECK (
        (ended_at IS NULL AND ended_by IS NULL AND end_reason IS NULL)
        OR ended_at IS NOT NULL
    ),

    CONSTRAINT emergency_responder_assignment_id_emergency_unique
    UNIQUE (id, emergency_id)
);

-- One active responder per emergency.
CREATE UNIQUE INDEX emergency_responder_one_active_idx
ON emergency_responder_assignments (emergency_id)
WHERE ended_at IS NULL;

-- One active emergency per responder.
CREATE UNIQUE INDEX emergency_responder_one_active_emergency_idx
ON emergency_responder_assignments (responder_id)
WHERE ended_at IS NULL;

CREATE INDEX emergency_responder_assignments_responder_idx
ON emergency_responder_assignments (responder_id, assigned_at DESC);

-- 4. Preserve patient and responder GPS location history.
CREATE TABLE emergency_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    emergency_id UUID NOT NULL
        REFERENCES emergencies(id) ON DELETE RESTRICT,

    location_type VARCHAR(20) NOT NULL
        CHECK (location_type IN ('PATIENT', 'RESPONDER')),

    patient_id UUID,

    responder_assignment_id UUID,

    location GEOGRAPHY(POINT, 4326) NOT NULL,

    latitude DOUBLE PRECISION NOT NULL
        CHECK (latitude BETWEEN -90 AND 90),

    longitude DOUBLE PRECISION NOT NULL
        CHECK (longitude BETWEEN -180 AND 180),

    accuracy_meters DOUBLE PRECISION
        CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),

    -- Device timestamp; not authoritative for ordering.
    recorded_at TIMESTAMPTZ,

    -- Server timestamp; authoritative for ordering.
    received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT emergency_location_owner_check
    CHECK (
        (
            location_type = 'PATIENT'
            AND patient_id IS NOT NULL
            AND responder_assignment_id IS NULL
        )
        OR
        (
            location_type = 'RESPONDER'
            AND patient_id IS NULL
            AND responder_assignment_id IS NOT NULL
        )
    ),

    CONSTRAINT emergency_location_coordinates_consistency
    CHECK (
        ST_Y(location::geometry) = latitude
        AND ST_X(location::geometry) = longitude
    ),

    -- Patient updates must belong to the emergency's patient.
    CONSTRAINT emergency_location_patient_fk
    FOREIGN KEY (emergency_id, patient_id)
    REFERENCES emergencies(id, patient_id)
    ON DELETE RESTRICT,

    -- Responder updates must belong to an assignment for this emergency.
    CONSTRAINT emergency_location_assignment_fk
    FOREIGN KEY (responder_assignment_id, emergency_id)
    REFERENCES emergency_responder_assignments(id, emergency_id)
    ON DELETE RESTRICT
);

CREATE INDEX emergency_locations_latest_idx
ON emergency_locations (emergency_id, location_type, received_at DESC);

CREATE INDEX emergency_locations_patient_history_idx
ON emergency_locations (patient_id, received_at DESC)
WHERE patient_id IS NOT NULL;

CREATE INDEX emergency_locations_assignment_history_idx
ON emergency_locations (responder_assignment_id, received_at DESC)
WHERE responder_assignment_id IS NOT NULL;

CREATE INDEX emergency_locations_spatial_idx
ON emergency_locations USING GIST (location);


-- +goose Down

DROP TABLE IF EXISTS emergency_locations;

DROP TABLE IF EXISTS emergency_responder_assignments;

ALTER TABLE emergencies
DROP CONSTRAINT IF EXISTS emergencies_facility_selection_consistency;

ALTER TABLE emergencies
DROP COLUMN IF EXISTS selected_facility_id,
DROP COLUMN IF EXISTS facility_selected_at,
DROP COLUMN IF EXISTS facility_selected_by;

ALTER TABLE emergencies
DROP CONSTRAINT IF EXISTS emergencies_id_patient_id_unique;
