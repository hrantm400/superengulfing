-- Admin 2FA: TOTP secrets for Google Authenticator

CREATE TABLE IF NOT EXISTS admin_2fa_secrets (
  email VARCHAR(255) PRIMARY KEY,
  secret VARCHAR(64) NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE admin_2fa_secrets ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE;
