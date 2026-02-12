-- Locale-specific content for broadcasts and sequence_emails (AM/EN)
-- Optional segment_locale filter for broadcasts; email_opens table; conditions for sequence steps

-- Broadcasts: optional locale-specific subject/body
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS subject_am TEXT;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS body_am TEXT;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS subject_en TEXT;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS body_en TEXT;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS segment_locale VARCHAR(5);

-- Sequence emails: optional locale-specific subject/body and conditions (e.g. previous_email_opened, has_tags)
ALTER TABLE sequence_emails ADD COLUMN IF NOT EXISTS subject_am TEXT;
ALTER TABLE sequence_emails ADD COLUMN IF NOT EXISTS body_am TEXT;
ALTER TABLE sequence_emails ADD COLUMN IF NOT EXISTS subject_en TEXT;
ALTER TABLE sequence_emails ADD COLUMN IF NOT EXISTS body_en TEXT;
ALTER TABLE sequence_emails ADD COLUMN IF NOT EXISTS conditions JSONB;

-- Email opens: detailed open tracking (in addition to email_log.status)
CREATE TABLE IF NOT EXISTS email_opens (
    id SERIAL PRIMARY KEY,
    email_log_id INTEGER NOT NULL REFERENCES email_log(id) ON DELETE CASCADE,
    subscriber_id INTEGER REFERENCES subscribers(id) ON DELETE SET NULL,
    opened_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_opens_log_id ON email_opens(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_opens_subscriber ON email_opens(subscriber_id);
