-- Admin two-step auth: one-time PIN codes sent to admin email

CREATE TABLE IF NOT EXISTS admin_pin_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(32) NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_pin_codes_email ON admin_pin_codes(email);
CREATE INDEX IF NOT EXISTS idx_admin_pin_codes_expires_at ON admin_pin_codes(expires_at);
