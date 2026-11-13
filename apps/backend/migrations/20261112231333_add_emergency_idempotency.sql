
-- +goose Up

CREATE TABLE emergency_idempotency_keys (
    patient_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    idempotency_key TEXT NOT NULL
        CHECK (length(trim(idempotency_key)) > 0),

    request_hash BYTEA NOT NULL
        CHECK (octet_length(request_hash) = 32),

    emergency_id UUID NOT NULL
        REFERENCES emergencies(id) ON DELETE RESTRICT,

    response_status SMALLINT NOT NULL
        CHECK (response_status = 202),

    response_body JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (patient_id, idempotency_key)
);

CREATE INDEX emergency_idempotency_expiry_idx
ON emergency_idempotency_keys(expires_at);

-- +goose Down

DROP TABLE IF EXISTS emergency_idempotency_keys;
