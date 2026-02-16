-- One-time token for thank-you page access (after confirmation)
-- Run: psql -d superengulfing_email -f 026_thank_you_token.sql

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS thank_you_token VARCHAR(255);
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS thank_you_token_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_subscribers_thank_you_token ON subscribers(thank_you_token) WHERE thank_you_token IS NOT NULL;
