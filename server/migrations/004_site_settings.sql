-- Site settings (affiliate link etc.) - editable from admin
CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT
);

INSERT INTO site_settings (key, value) VALUES
  ('affiliate_label', 'Test Affiliate Link'),
  ('affiliate_url', 'https://www.wix.com')
ON CONFLICT (key) DO NOTHING;
