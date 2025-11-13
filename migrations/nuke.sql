-- Nuke all tables
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS turnstile_validations;
PRAGMA foreign_keys = ON;
