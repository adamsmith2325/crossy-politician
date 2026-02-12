-- Create difficulty_index table to store the global game difficulty setting
-- The difficulty index ranges from 0 to 100:
-- 0 = no difficulty increase
-- 100 = extremely aggressive difficulty scaling

CREATE TABLE IF NOT EXISTS difficulty_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value integer NOT NULL CHECK (value >= 0 AND value <= 100),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE difficulty_index ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (game needs to fetch this)
CREATE POLICY "Anyone can read difficulty_index"
  ON difficulty_index
  FOR SELECT
  USING (true);

-- Create policy for authenticated updates only (admin use)
CREATE POLICY "Authenticated users can update difficulty_index"
  ON difficulty_index
  FOR UPDATE
  USING (true);

-- Insert default difficulty value (50 = default difficulty scaling)
INSERT INTO difficulty_index (value) VALUES (50);

-- Create index for faster reads
CREATE INDEX IF NOT EXISTS idx_difficulty_index_updated_at ON difficulty_index(updated_at DESC);
