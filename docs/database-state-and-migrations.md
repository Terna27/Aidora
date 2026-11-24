# AIDORA — Database State and Migrations

**Last updated:** 24 November 2026  
**Status:** Database schema initialized and verified; application integration testing pending.

## 1. Overview

AIDORA uses PostgreSQL with PostGIS for relational data storage and geospatial operations, including healthcare facility locations and emergency tracking. Database schema changes are managed using Goose SQL migrations in `apps/backend/migrations/`.

## 2. Current database environment

| Component | Current configuration |
|---|---|
| Database provider | Neon |
| Project | `aidora` |
| Branch | `production` |
| Application database | `aidora` |
| Database role | `neondb_owner` |
| Schema | `public` |
| PostGIS | 3.6.4 |
| PL/pgSQL | 1.0 |
| Goose CLI | v3.30.1 |
| Current migration version | `20261115160700` |
| Applied migrations | 9 |
| Pending migrations | 0 |
| Public base tables | 21 |
| Registered users at verification | 0 |

The production-named Neon branch is being used for pre-launch integration testing. It must not be treated as evidence that AIDORA is ready for live emergency operations. The PostgreSQL server version was not independently recorded during this verification.

## 3. Migration history

All nine migrations were successfully applied on 24 November 2026.

| Migration file | Status |
|---|---|
| `20261111024911_initial_schema.sql` | Applied |
| `20261111031933_user_roles_and_profiles.sql` | Applied |
| `20261111035852_healthcare_facilities.sql` | Applied |
| `20261112090930_add_emergencies_and_state_history.sql` | Applied |
| `20261112231333_add_emergency_idempotency.sql` | Applied |
| `20261113113507_add_authentication_sessions_and_verification.sql` | Applied |
| `20261113235712_correct_auth_session_refresh_token_hash.sql` | Applied |
| `20261114151015_add_emergency_tracking.sql` | Applied |
| `20261115160700_add_responder_management.sql` | Applied |

## 4. Verified database tables

| Module | Tables |
|---|---|
| Authentication and users | `users`, `user_roles`, `user_sessions`, `auth_verification_challenges` |
| Patient management | `patient_profiles` |
| Responder management | `responder_profiles`, `responder_types`, `responder_profile_types`, `responder_documents`, `responder_document_requirements`, `responder_document_reviews`, `responder_verification_reviews` |
| Emergency management | `emergencies`, `emergency_state_history`, `emergency_idempotency_keys`, `emergency_locations`, `emergency_responder_assignments` |
| Healthcare facilities | `facilities`, `facility_capabilities` |
| Database infrastructure | `goose_db_version`, `spatial_ref_sys` |

The 21 tables include 19 application tables and two infrastructure tables. Table existence was verified; this does not establish that every constraint, index, or application workflow has been tested against Neon.

## 5. Database recovery record

The deployed email verification endpoint previously failed with `SQLSTATE 42P01` because the `users` relation was missing. Inspection of the current Neon branch revealed only `neondb` and `postgres`. A dedicated `aidora` database was created and initialized using the existing migrations.

The first two migrations succeeded. The healthcare facilities migration then failed with `SQLSTATE 42704` because the `GEOGRAPHY` type was unavailable. PostGIS was enabled in the target database using:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Goose subsequently resumed from the failed migration and successfully applied the remaining seven migrations. No reset, rollback, or historical migration modification was required. The final migration version and critical tables were independently verified.

## 6. Initializing and migrating a database

### Prerequisites

- A PostgreSQL database with a role authorized to install the required extensions and apply migrations.
- Goose installed and the repository's migration files available.
- A direct database connection string for the intended environment.

For a fresh database, select the correct target database and enable PostGIS before running migrations:

```sql
SELECT current_database();
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT to_regtype('geography');
```

From `apps/backend`, create a local `.env.migrations` file:

```dotenv
GOOSE_DRIVER=postgres
GOOSE_MIGRATION_DIR=migrations
GOOSE_DBSTRING=postgresql://USERNAME:PASSWORD@HOST/aidora?sslmode=require
```

Use the actual direct connection string supplied by Neon, including its required connection parameters. Ensure `.env.migrations` is ignored by Git before storing credentials. Never commit connection strings or passwords.

Load the file in PowerShell:

```powershell
Get-Content .env.migrations | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $parts = $line -split '=', 2
        if ($parts.Count -eq 2) {
            [Environment]::SetEnvironmentVariable(
                $parts[0].Trim(), $parts[1].Trim(), 'Process'
            )
        }
    }
}
```

Verify the target without printing credentials:

```powershell
$dbUri = [Uri]$env:GOOSE_DBSTRING
Write-Host 'Database:' $dbUri.AbsolutePath.TrimStart('/')
Write-Host 'Host:' $dbUri.Host
```

Compare the host and database with the intended Neon environment. Validate and inspect migrations:

```powershell
goose validate
goose status
```

After confirming the target and reviewing pending migrations, run:

```powershell
goose up
```

If a command fails, stop and investigate before continuing. Do not use `goose reset`, destructive SQL, or rollback commands as a routine recovery mechanism. For databases containing important data, establish a backup or recovery point before applying changes.

After successful migration:

```powershell
goose status
goose version
```

For the migration set recorded in this document, the expected version is `20261115160700`.

## 7. Database verification

Run the following SQL in the intended database after migration:

```sql
SELECT current_database(), current_user, current_schema();

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

SELECT version_id, is_applied, tstamp
FROM public.goose_db_version
ORDER BY id;
```

## 8. Deployment and outstanding work

The recommended connection arrangement is a direct Neon connection for Goose and a pooled Neon connection for the Render backend via `DATABASE_URL`, subject to application compatibility. Both connections must target the intended database. Keep credentials outside source control.

The deployed `/health` endpoint returned `success: true` and `status: ok`. However, the health response alone does not establish that Render is connected to the newly migrated database.

Remaining work:

- Confirm Render's `DATABASE_URL` targets the new `aidora` database and verify the deployed revision.
- Register a test patient and verify user, role, and profile persistence.
- Test Brevo email delivery, email verification, and login; keep SMS disabled.
- Document or automate PostGIS initialization as part of database provisioning.
- Verify application workflows against Neon before live use, and establish a reviewed test-data cleanup and backup procedure before launch.

## 9. Migration maintenance policy

Use new versioned migrations for subsequent schema changes. Review migration SQL and test against a disposable database before deployment. Avoid modifying previously applied migrations without an explicit, reviewed migration strategy. Keep environment-specific secrets out of Git and verify the target database before every migration operation.
