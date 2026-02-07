-- Broadcast segment: send to "all active" or "subscribers with tag(s)"
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS segment_type VARCHAR(20) DEFAULT 'all';
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS segment_tag_ids JSONB DEFAULT '[]';
