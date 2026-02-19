-- USDT TRC20 payment orders for LiquidityScan PRO and paid courses.

CREATE TABLE IF NOT EXISTS usdt_orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(64) UNIQUE NOT NULL,
  product_type VARCHAR(32) NOT NULL,
  product_id INTEGER,
  user_id INTEGER REFERENCES dashboard_users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  amount_usdt NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  tx_hash VARCHAR(128),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usdt_orders_order_id ON usdt_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_usdt_orders_status_amount ON usdt_orders(status, amount_usdt);
