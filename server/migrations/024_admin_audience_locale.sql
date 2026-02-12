-- Admin audience locale: broadcasts, sequences, tags, templates belong to a locale (am/en)
-- So Armenian and English admin views show and create only their audience's data.

-- broadcasts
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_broadcasts_locale ON broadcasts(locale);

-- sequences
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_sequences_locale ON sequences(locale);

-- tags: allow same tag name in different locales (drop unique on name, add unique on (name, locale))
ALTER TABLE tags ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'en';
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS tags_name_locale_key ON tags(name, locale);
CREATE INDEX IF NOT EXISTS idx_tags_locale ON tags(locale);

-- templates
ALTER TABLE templates ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_templates_locale ON templates(locale);
