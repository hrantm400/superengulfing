-- Add double opt-in columns to subscribers (confirmation_token, confirmed_at, locale)
-- Run: psql -d superengulfing_email -f 020_subscribers_double_optin.sql

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(255);
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS locale VARCHAR(5);
