-- Migration: add risk score metadata to fraud_blacklist
-- Adds persisted risk score + breakdown so blacklist entries mirror validation/submission explainability

ALTER TABLE fraud_blacklist
	ADD COLUMN risk_score REAL;

ALTER TABLE fraud_blacklist
	ADD COLUMN risk_score_breakdown TEXT;

-- Backfill historical rows with heuristic scores based on detection confidence
UPDATE fraud_blacklist
SET risk_score = CASE detection_confidence
	WHEN 'high' THEN 100
	WHEN 'medium' THEN 80
	WHEN 'low' THEN 70
	ELSE 0
END
WHERE risk_score IS NULL;
