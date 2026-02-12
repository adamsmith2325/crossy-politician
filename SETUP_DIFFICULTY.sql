-- Quick setup script for difficulty_index table
-- Run this in Supabase SQL Editor if you haven't run the migration yet

-- Create the table
CREATE TABLE IF NOT EXISTS difficulty_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value integer NOT NULL CHECK (value >= 0 AND value <= 100),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE difficulty_index ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Anyone can read difficulty_index" ON difficulty_index;
CREATE POLICY "Anyone can read difficulty_index"
  ON difficulty_index
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can update difficulty_index" ON difficulty_index;
CREATE POLICY "Authenticated users can update difficulty_index"
  ON difficulty_index
  FOR UPDATE
  USING (true);

-- Insert default difficulty value (or update if exists)
-- 50 = Default difficulty (tuned for fast-paced, challenging gameplay)
INSERT INTO difficulty_index (value)
VALUES (50)
ON CONFLICT DO NOTHING;

-- If you want to update existing value instead:
-- UPDATE difficulty_index SET value = 50, updated_at = now();

-- Verify the setup
SELECT * FROM difficulty_index;
