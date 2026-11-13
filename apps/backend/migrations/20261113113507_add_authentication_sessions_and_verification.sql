
-- +goose Up

-- Allow registration with either email or phone number.
ALTER TABLE users
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN phone_number DROP NOT NULL;

-- Every account must have at least one login identifier.
ALTER TABLE users
    ADD CONSTRAINT users_contact_identifier_check
    CHECK (
        email IS NOT NULL
        OR phone_number IS NOT NULL
    );

-- Track verification independently.
ALTER TABLE users
    ADD COLUMN email_verified_at TIMESTAMPTZ,
    ADD COLUMN phone_verified_at TIMESTAMPTZ;

-- Email addresses must be unique regardless of letter casing.
CREATE UNIQUE INDEX users_email_lower_unique
    ON users (LOWER(email))
    WHERE email IS NOT NULL;

-- Store refresh-token sessions.
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    family_id UUID NOT NULL,

    code_hash BYTEA NOT NULL
    CHECK (octet_length(code_hash) = 32),

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    revoked_reason VARCHAR(50),

    replaced_by_session_id UUID
        REFERENCES user_sessions(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_used_at TIMESTAMPTZ,

    CHECK (
        (revoked_at IS NULL AND revoked_reason IS NULL)
        OR revoked_at IS NOT NULL
    )
);

CREATE INDEX idx_user_sessions_user_id
    ON user_sessions(user_id);

CREATE INDEX idx_user_sessions_family_id
    ON user_sessions(family_id);

CREATE INDEX idx_user_sessions_expires_at
    ON user_sessions(expires_at);

-- Email, phone verification and password-reset challenges.
CREATE TABLE auth_verification_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    purpose VARCHAR(30) NOT NULL
        CHECK (
            purpose IN (
                'verify_email',
                'verify_phone',
                'password_reset'
            )
        ),

    channel VARCHAR(10) NOT NULL
        CHECK (channel IN ('email', 'phone')),

    destination VARCHAR(255) NOT NULL,

    code_hash BYTEA NOT NULL
    CHECK (octet_length(code_hash) = 32),

    expires_at TIMESTAMPTZ NOT NULL,

    consumed_at TIMESTAMPTZ,

    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        (purpose = 'verify_email' AND channel = 'email')
        OR
        (purpose = 'verify_phone' AND channel = 'phone')
        OR
        (purpose = 'password_reset')
    )
);

CREATE INDEX idx_auth_challenges_user_purpose
    ON auth_verification_challenges(user_id, purpose);

CREATE INDEX idx_auth_challenges_expiry
    ON auth_verification_challenges(expires_at);

-- +goose Down

DROP TABLE IF EXISTS auth_verification_challenges;
DROP TABLE IF EXISTS user_sessions;

DROP INDEX IF EXISTS users_email_lower_unique;

ALTER TABLE users
    DROP COLUMN IF EXISTS email_verified_at,
    DROP COLUMN IF EXISTS phone_verified_at;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_contact_identifier_check;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM users
        WHERE email IS NULL OR phone_number IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot reverse authentication migration: users without both identifiers exist';
    END IF;
END
$$;

ALTER TABLE users
    ALTER COLUMN email SET NOT NULL,
    ALTER COLUMN phone_number SET NOT NULL;


