-- Income table for tracking recurring income (salary, etc.)
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency TEXT NOT NULL DEFAULT 'month',
  active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_income_user_id ON income(user_id);
CREATE INDEX IF NOT EXISTS idx_income_start_date ON income(start_date);

-- Enable Row Level Security (RLS)
ALTER TABLE income ENABLE ROW LEVEL SECURITY;

-- RLS Policies for income
CREATE POLICY "Users can view their own income"
  ON income FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own income"
  ON income FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own income"
  ON income FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own income"
  ON income FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_income_updated_at
  BEFORE UPDATE ON income
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

