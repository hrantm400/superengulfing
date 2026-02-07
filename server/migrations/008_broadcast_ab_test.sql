-- A/B subject test: subject_b, ab_test_ends_at, ab_test_winner
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS subject_b VARCHAR(500);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS ab_test_ends_at TIMESTAMP;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS ab_test_winner VARCHAR(1);
