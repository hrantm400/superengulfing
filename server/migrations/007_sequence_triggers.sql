-- When a subscriber gets a tag, optionally auto-add them to a sequence
CREATE TABLE IF NOT EXISTS sequence_triggers (
  id SERIAL PRIMARY KEY,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tag_id, sequence_id)
);

CREATE INDEX IF NOT EXISTS idx_sequence_triggers_tag ON sequence_triggers(tag_id);
