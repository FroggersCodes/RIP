-- Runs once on first database init (postgres entrypoint). Creates the test DB
-- used by `npm test`. The main `rip` database is created by POSTGRES_DB.
CREATE DATABASE rip_test;
