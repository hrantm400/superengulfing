-- Payment issue reports: user reports "payment didn't go through" with screenshot and message.
-- Admin can resolve and optionally grant course/liquidityscan access.

CREATE TABLE IF NOT EXISTS payment_issue_reports (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(64),
  product_type VARCHAR(32) NOT NULL,
  email VARCHAR(255),
  message TEXT NOT NULL,
  screenshot_url VARCHAR(512),
  status VARCHAR(20) DEFAULT 'pending',
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_issue_reports_status ON payment_issue_reports(status);
CREATE INDEX IF NOT EXISTS idx_payment_issue_reports_created_at ON payment_issue_reports(created_at DESC);
