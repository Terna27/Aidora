
-- +goose Up

-- 1. Create a table for user role assignments.
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    role VARCHAR(30) NOT NULL
        CHECK (role IN ('patient', 'responder', 'admin')),

    PRIMARY KEY (user_id, role)
);


-- 2. Preserve existing user roles.
INSERT INTO user_roles (user_id, role)
SELECT id, role
FROM users;


-- 3. Create patient profiles.
CREATE TABLE patient_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 4. Create responder profiles.
CREATE TABLE responder_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 5. Remove the old single-role column.
ALTER TABLE users DROP COLUMN role;


-- +goose Down

-- Check whether rollback can safely restore the old single-role design.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        GROUP BY u.id
        HAVING COUNT(ur.role) != 1
    ) THEN
        RAISE EXCEPTION
            'Cannot reverse migration: every user must have exactly one role';
    END IF;

    IF EXISTS (SELECT 1 FROM patient_profiles)
       OR EXISTS (SELECT 1 FROM responder_profiles) THEN
        RAISE EXCEPTION
            'Cannot reverse migration: profile tables contain data';
    END IF;
END
$$;

-- Restore the original role column.
ALTER TABLE users ADD COLUMN role VARCHAR(30);

UPDATE users u
SET role = ur.role
FROM user_roles ur
WHERE ur.user_id = u.id;

ALTER TABLE users ALTER COLUMN role SET NOT NULL;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('patient', 'responder', 'admin'));

-- Remove the new structures.
DROP TABLE responder_profiles;
DROP TABLE patient_profiles;
DROP TABLE user_roles;
