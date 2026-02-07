-- Email Analytics Migration
-- Run this to add tracking columns and clicks table

-- Add opened_at and clicked_at columns to email_log
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP;

-- Create email_clicks table to track individual link clicks
CREATE TABLE IF NOT EXISTS email_clicks (
    id SERIAL PRIMARY KEY,
    email_log_id INTEGER REFERENCES email_log(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    clicked_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_clicks_log_id ON email_clicks(email_log_id);
