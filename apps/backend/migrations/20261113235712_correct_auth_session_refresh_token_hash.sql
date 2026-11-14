-- +goose Up

-- Rename the session hash column to reflect its purpose.
ALTER TABLE user_sessions
    RENAME COLUMN code_hash TO refresh_token_hash;

-- Prevent the same refresh-token hash from belonging to multiple sessions.
ALTER TABLE user_sessions
    ADD CONSTRAINT user_sessions_refresh_token_hash_key
    UNIQUE (refresh_token_hash);


-- +goose Down

ALTER TABLE user_sessions
    DROP CONSTRAINT user_sessions_refresh_token_hash_key;

ALTER TABLE user_sessions
    RENAME COLUMN refresh_token_hash TO code_hash;