-- TradingView indicator access: username, status, timestamps, rejection reason
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS tradingview_username TEXT;
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS indicator_access_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS indicator_requested_at TIMESTAMP;
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS indicator_rejected_reason TEXT;
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS indicator_rejected_at TIMESTAMP;
