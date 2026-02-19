-- USDT TRC20 deposit addresses per order + sweep metadata.

CREATE TABLE IF NOT EXISTS usdt_deposit_addresses (
  id SERIAL PRIMARY KEY,
  address VARCHAR(64) UNIQUE NOT NULL,
  private_key TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  assigned_at TIMESTAMP,
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usdt_deposit_addresses_status ON usdt_deposit_addresses(status);

ALTER TABLE usdt_orders
  ADD COLUMN IF NOT EXISTS deposit_address_id INTEGER REFERENCES usdt_deposit_addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS swept_to_main BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sweep_tx_hash VARCHAR(128);

