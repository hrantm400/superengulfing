-- Paid courses: is_paid, price_display on courses; course_payments for idempotent enrollment after payment.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price_display VARCHAR(20) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS course_payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount_cents INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_payments_course_id ON course_payments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_payments_user_id ON course_payments(user_id);
