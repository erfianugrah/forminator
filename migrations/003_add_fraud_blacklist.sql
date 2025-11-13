-- Migration: Add fraud_blacklist table for pre-validation blocking
-- Date: 2025-11-13
-- Description: Add blacklist table to block known fraudulent ephemeral IDs and IPs before expensive Turnstile API calls

-- Fraud detection blacklist table
-- Stores blocked ephemeral IDs and IPs for pre-validation blocking
CREATE TABLE IF NOT EXISTS fraud_blacklist (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- Identifier (ephemeral_id or IP address)
	ephemeral_id TEXT,
	ip_address TEXT,
	-- Block metadata
	block_reason TEXT NOT NULL,
	detection_confidence TEXT NOT NULL CHECK(detection_confidence IN ('high', 'medium', 'low')),
	-- Timing
	blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	expires_at DATETIME NOT NULL,
	-- Detection context
	submission_count INTEGER DEFAULT 0,
	last_seen_at DATETIME,
	-- Pattern metadata (JSON)
	detection_metadata TEXT,
	-- Constraints: at least one identifier must be present
	CHECK((ephemeral_id IS NOT NULL) OR (ip_address IS NOT NULL))
);

-- Indexes for fast pre-validation lookups
CREATE INDEX IF NOT EXISTS idx_blacklist_ephemeral_id ON fraud_blacklist(ephemeral_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_ip ON fraud_blacklist(ip_address, expires_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON fraud_blacklist(expires_at);
