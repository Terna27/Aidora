
-- +goose Up

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    phone_number VARCHAR(30) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL
        CHECK (role IN ('patient', 'responder', 'admin')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- +goose Down

DROP TABLE IF EXISTS users;
