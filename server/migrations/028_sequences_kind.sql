-- Add kind column to sequences to distinguish PDF / Access / Courses / LiquidityScan flows
-- Values (recommended):
--   'pdf'      - PDF nurture sequences
--   'access'   - Access page / pre-course sequences
--   'course'   - Buyers of courses
--   'liqscan'  - Buyers of LiquidityScan

ALTER TABLE sequences
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_sequences_kind_locale
  ON sequences(kind, locale);

