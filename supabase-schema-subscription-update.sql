-- Update subscriptions table to add date fields
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS next_billing_date DATE;

-- Create index for next_billing_date for better query performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date 
ON subscriptions(next_billing_date);

