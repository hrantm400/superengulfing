-- Locale column for courses so we can separate EN / AM catalogs.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_courses_locale ON courses(locale);

