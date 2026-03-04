-- Add network column to usdt_orders to distinguish TRC20 vs BEP20 (and others in future)

ALTER TABLE usdt_orders
  ADD COLUMN IF NOT EXISTS network VARCHAR(16) DEFAULT 'trc20';

CREATE INDEX IF NOT EXISTS idx_usdt_orders_network_status
  ON usdt_orders(network, status);

