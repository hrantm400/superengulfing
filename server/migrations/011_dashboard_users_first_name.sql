-- Add first_name to dashboard_users for profile display
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
