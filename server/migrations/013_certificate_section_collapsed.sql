-- Remember "Your Certificate" section collapsed state per user
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS certificate_section_collapsed BOOLEAN DEFAULT false;
