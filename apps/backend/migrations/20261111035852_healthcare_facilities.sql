
-- +goose Up

-- 1. Create healthcare facilities.
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,

    facility_type VARCHAR(30) NOT NULL
        CHECK (
            facility_type IN (
                'public',
                'private',
                'mission',
                'other'
            )
        ),

    phone_number VARCHAR(30) NOT NULL,

    email VARCHAR(255),

    address TEXT NOT NULL,

    city VARCHAR(100) NOT NULL,

    state VARCHAR(100) NOT NULL,

    country VARCHAR(100) NOT NULL,

    location GEOGRAPHY(POINT, 4326),

    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'temporarily_closed',
                'inactive'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. Create facility capabilities.
CREATE TABLE facility_capabilities (
    facility_id UUID NOT NULL
        REFERENCES facilities(id) ON DELETE CASCADE,

    capability VARCHAR(80) NOT NULL,

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (facility_id, capability)
);


-- 3. Add an index for spatial searches.
CREATE INDEX facilities_location_idx
ON facilities
USING GIST (location);


-- 4. Add an index for filtering active facilities.
CREATE INDEX facilities_status_idx
ON facilities (status);


-- 5. Add an index for capability searches.
CREATE INDEX facility_capabilities_search_idx
ON facility_capabilities (capability, is_available);


-- +goose Down

DROP TABLE IF EXISTS facility_capabilities;

DROP TABLE IF EXISTS facilities;
