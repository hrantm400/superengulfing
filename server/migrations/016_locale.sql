-- Add locale (en | am) for access requests, dashboard users, and subscribers

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_access_requests_locale ON access_requests(locale);
CREATE INDEX IF NOT EXISTS idx_subscribers_locale ON subscribers(locale);
