-- Replace Vimeo with Wistia for lesson video_type
-- 1. Update existing rows
UPDATE lessons SET video_type = 'wistia' WHERE video_type = 'vimeo';

-- 2. Drop old check and add new one
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_video_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_video_type_check CHECK (video_type IN ('youtube', 'wistia'));
