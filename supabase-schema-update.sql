-- Update transactions table to add receipt_image_url
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

-- Create storage bucket for receipts (run this in Supabase SQL Editor)
-- Note: You'll need to create the bucket manually in Supabase Storage UI
-- and set up the storage policies below

-- Storage policies for receipts bucket
-- These should be created in Supabase Dashboard > Storage > Policies

-- Policy: Users can upload their own receipts
-- CREATE POLICY "Users can upload their own receipts"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'receipts' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- Policy: Users can view their own receipts
-- CREATE POLICY "Users can view their own receipts"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'receipts' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- Policy: Users can delete their own receipts
-- CREATE POLICY "Users can delete their own receipts"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'receipts' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

