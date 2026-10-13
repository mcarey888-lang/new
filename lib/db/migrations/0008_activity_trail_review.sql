-- App-owned moderation only. Never promotes or modifies canonical catalogue.
ALTER TABLE activity_trail_suggestions ADD COLUMN IF NOT EXISTS review_notes text;
ALTER TABLE activity_trail_suggestions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
