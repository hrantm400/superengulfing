-- Add tx_id to payment_issue_reports so users can submit their transaction ID.

ALTER TABLE payment_issue_reports
  ADD COLUMN IF NOT EXISTS tx_id VARCHAR(128);
