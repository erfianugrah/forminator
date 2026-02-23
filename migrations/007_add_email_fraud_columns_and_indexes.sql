-- Migration: Add email fraud detection columns and missing performance indexes
-- These columns exist in schema.sql but were never added via migration

-- Email fraud detection columns on submissions table
ALTER TABLE submissions ADD COLUMN email_risk_score REAL;
ALTER TABLE submissions ADD COLUMN email_fraud_signals TEXT;
ALTER TABLE submissions ADD COLUMN email_pattern_type TEXT;
ALTER TABLE submissions ADD COLUMN email_markov_detected INTEGER;
ALTER TABLE submissions ADD COLUMN email_ood_detected INTEGER;

-- Missing index for email pattern type queries
CREATE INDEX IF NOT EXISTS idx_submissions_email_pattern ON submissions(email_pattern_type);

-- Performance indexes missing from both migrations and schema.sql
-- Composite index for IP rate-limiting queries: WHERE remote_ip = ? AND created_at > ?
CREATE INDEX IF NOT EXISTS idx_submissions_remote_ip_created ON submissions(remote_ip, created_at);

-- Foreign key index for LEFT JOIN turnstile_validations ON submission_id
CREATE INDEX IF NOT EXISTS idx_validations_submission_id ON turnstile_validations(submission_id);

-- Recency index for blacklist queries: WHERE blocked_at > ? / ORDER BY blocked_at DESC
CREATE INDEX IF NOT EXISTS idx_blacklist_blocked_at ON fraud_blacklist(blocked_at);

-- Composite index for IP rate-limiting on turnstile_validations
CREATE INDEX IF NOT EXISTS idx_validations_remote_ip_created ON turnstile_validations(remote_ip, created_at);
