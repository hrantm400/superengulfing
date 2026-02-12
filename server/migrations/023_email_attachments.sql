-- Attachments for broadcasts and sequence emails: array of { filename, path } (path relative to server root, e.g. uploads/xxx.pdf)
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE sequence_emails ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
