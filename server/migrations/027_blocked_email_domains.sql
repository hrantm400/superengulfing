-- Blocked email domains (internal blocklist managed by admin UI)
-- Used to prevent disposable/temporary email domains from registering/subscribing.

CREATE TABLE IF NOT EXISTS blocked_email_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

