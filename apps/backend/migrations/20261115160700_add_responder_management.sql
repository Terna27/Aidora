-- +goose Up

-- 1. Supported responder categories.
CREATE TABLE responder_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO responder_types (code, name, description)
VALUES
(
    'ambulance_driver',
    'Ambulance Driver',
    'Qualified personnel responsible for emergency ambulance transportation.'
),
(
    'paramedic',
    'Paramedic',
    'Qualified emergency medical personnel providing pre-hospital care.'
),
(
    'other_transport_provider',
    'Other Emergency Transport Provider',
    'Other approved providers of emergency patient transportation services.'
);


-- 2. Extend existing responder profiles.
ALTER TABLE responder_profiles
    ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            verification_status IN (
                'pending',
                'verified',
                'rejected',
                'suspended'
            )
        ),

    ADD COLUMN availability_status VARCHAR(10) NOT NULL DEFAULT 'offline'
        CHECK (
            availability_status IN ('online', 'offline')
        ),

    ADD COLUMN service_description TEXT,

    ADD COLUMN verified_at TIMESTAMPTZ;


-- 3. A responder can have multiple capabilities.
CREATE TABLE responder_profile_types (
    responder_user_id UUID NOT NULL
        REFERENCES responder_profiles(user_id) ON DELETE CASCADE,

    responder_type_id UUID NOT NULL
        REFERENCES responder_types(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (responder_user_id, responder_type_id)
);


-- 4. Configurable document requirements per responder category.
CREATE TABLE responder_document_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    responder_type_id UUID NOT NULL
        REFERENCES responder_types(id),

    requirement_code VARCHAR(80) NOT NULL,

    name VARCHAR(150) NOT NULL,

    evidence_category VARCHAR(40) NOT NULL
        CHECK (
            evidence_category IN (
                'identity',
                'contact',
                'vehicle',
                'driving_authorisation',
                'service_eligibility',
                'profile'
            )
        ),

    description TEXT,

    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,

    expiry_required BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (responder_type_id, requirement_code),

    UNIQUE (id, responder_type_id),

    CHECK (
        expiry_required = FALSE
        OR is_mandatory = TRUE
    )
);


-- 4a. Seed mandatory evidence requirements for each responder category.
INSERT INTO responder_document_requirements (
    responder_type_id,
    requirement_code,
    name,
    evidence_category,
    description,
    is_mandatory,
    expiry_required
)
SELECT
    rt.id,
    requirements.requirement_code,
    requirements.name,
    requirements.evidence_category,
    requirements.description,
    TRUE,
    requirements.expiry_required
FROM (
    VALUES
        -- Ambulance drivers
        (
            'ambulance_driver',
            'identity_proof',
            'Identity Evidence',
            'identity',
            'Government-issued identity evidence.',
            FALSE
        ),
        (
            'ambulance_driver',
            'driving_licence',
            'Valid Driving Licence',
            'driving_authorisation',
            'Valid licence authorising the responder to drive.',
            TRUE
        ),
        (
            'ambulance_driver',
            'vehicle_registration',
            'Vehicle Registration',
            'vehicle',
            'Valid registration for the ambulance or transport vehicle.',
            TRUE
        ),
        (
            'ambulance_driver',
            'roadworthiness_certificate',
            'Vehicle Roadworthiness Certificate',
            'vehicle',
            'Current roadworthiness evidence for the transport vehicle.',
            TRUE
        ),
        (
            'ambulance_driver',
            'vehicle_insurance',
            'Vehicle Insurance',
            'vehicle',
            'Current insurance documentation for the transport vehicle.',
            TRUE
        ),

        -- Paramedics
        (
            'paramedic',
            'identity_proof',
            'Identity Evidence',
            'identity',
            'Government-issued identity evidence.',
            FALSE
        ),
        (
            'paramedic',
            'professional_qualification',
            'Professional Qualification',
            'service_eligibility',
            'Evidence of relevant paramedic or emergency medical qualification.',
            FALSE
        ),
        (
            'paramedic',
            'professional_registration',
            'Professional Registration',
            'service_eligibility',
            'Current professional registration or practising licence.',
            TRUE
        ),

        -- Other emergency transport providers
        (
            'other_transport_provider',
            'identity_proof',
            'Identity Evidence',
            'identity',
            'Government-issued identity evidence.',
            FALSE
        ),
        (
            'other_transport_provider',
            'provider_authorisation',
            'Service Provider Authorisation',
            'service_eligibility',
            'Evidence authorising the provider to operate emergency transport services.',
            TRUE
        ),
        (
            'other_transport_provider',
            'vehicle_registration',
            'Vehicle Registration',
            'vehicle',
            'Valid registration for the transport vehicle.',
            TRUE
        ),
        (
            'other_transport_provider',
            'roadworthiness_certificate',
            'Vehicle Roadworthiness Certificate',
            'vehicle',
            'Current roadworthiness evidence for the transport vehicle.',
            TRUE
        ),
        (
            'other_transport_provider',
            'vehicle_insurance',
            'Vehicle Insurance',
            'vehicle',
            'Current insurance documentation for the transport vehicle.',
            TRUE
        )
) AS requirements (
    type_code,
    requirement_code,
    name,
    evidence_category,
    description,
    expiry_required
)
JOIN responder_types rt
    ON rt.code = requirements.type_code;


-- 5. Submitted responder verification documents.
CREATE TABLE responder_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    responder_user_id UUID NOT NULL,

    responder_type_id UUID NOT NULL,

    requirement_id UUID NOT NULL,

    storage_key TEXT NOT NULL,

    original_filename VARCHAR(255) NOT NULL,

    mime_type VARCHAR(100) NOT NULL,

    file_size_bytes BIGINT NOT NULL
        CHECK (file_size_bytes > 0),

    document_number VARCHAR(150),

    issued_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'expired'
            )
        ),

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        expires_at IS NULL
        OR issued_at IS NULL
        OR expires_at > issued_at
    ),

    FOREIGN KEY (responder_user_id, responder_type_id)
        REFERENCES responder_profile_types(
            responder_user_id,
            responder_type_id
        ),

    FOREIGN KEY (requirement_id, responder_type_id)
        REFERENCES responder_document_requirements(
            id,
            responder_type_id
        )
);

CREATE INDEX idx_responder_documents_user
    ON responder_documents(responder_user_id);

CREATE INDEX idx_responder_documents_requirement
    ON responder_documents(requirement_id);

CREATE INDEX idx_responder_documents_expiry
    ON responder_documents(expires_at)
    WHERE status = 'approved';


-- 6. Document review audit history.
CREATE TABLE responder_document_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL
        REFERENCES responder_documents(id) ON DELETE CASCADE,

    reviewer_user_id UUID NOT NULL
        REFERENCES users(id),

    decision VARCHAR(20) NOT NULL
        CHECK (decision IN ('approved', 'rejected')),

    reason TEXT,

    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        decision != 'rejected'
        OR (
            reason IS NOT NULL
            AND LENGTH(TRIM(reason)) > 0
        )
    )
);

CREATE INDEX idx_responder_document_reviews_document
    ON responder_document_reviews(document_id);


-- 7. Responder verification decision history.
CREATE TABLE responder_verification_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    responder_user_id UUID NOT NULL
        REFERENCES responder_profiles(user_id) ON DELETE CASCADE,

    reviewer_user_id UUID NOT NULL
        REFERENCES users(id),

    second_reviewer_user_id UUID
        REFERENCES users(id),

    decision VARCHAR(20) NOT NULL
        CHECK (
            decision IN (
                'verified',
                'rejected',
                'suspended',
                'reinstated'
            )
        ),

    reason TEXT,

    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        decision NOT IN ('rejected', 'suspended')
        OR (
            reason IS NOT NULL
            AND LENGTH(TRIM(reason)) > 0
        )
    ),

    CHECK (
        decision != 'reinstated'
        OR (
            second_reviewer_user_id IS NOT NULL
            AND second_reviewer_user_id != reviewer_user_id
        )
    )
);

CREATE INDEX idx_responder_verification_reviews_user
    ON responder_verification_reviews(responder_user_id);


-- 8. Useful responder lookup indexes.
CREATE INDEX idx_responder_profiles_verification
    ON responder_profiles(verification_status);

CREATE INDEX idx_responder_profiles_availability
    ON responder_profiles(availability_status);


-- +goose Down

DROP TABLE IF EXISTS responder_verification_reviews;
DROP TABLE IF EXISTS responder_document_reviews;
DROP TABLE IF EXISTS responder_documents;
DROP TABLE IF EXISTS responder_document_requirements;
DROP TABLE IF EXISTS responder_profile_types;

DROP INDEX IF EXISTS idx_responder_profiles_availability;
DROP INDEX IF EXISTS idx_responder_profiles_verification;

ALTER TABLE responder_profiles
    DROP COLUMN IF EXISTS verified_at,
    DROP COLUMN IF EXISTS service_description,
    DROP COLUMN IF EXISTS availability_status,
    DROP COLUMN IF EXISTS verification_status;

DROP TABLE IF EXISTS responder_types;
