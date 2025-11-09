# Quick Fix for Storage RLS Errors

If you're seeing this error:
```
StorageApiError: new row violates row-level security policy
```

## Solution 1: Make Bucket Public (Easiest - 2 minutes)

1. Go to Supabase Dashboard → **Storage**
2. Find the `receipts` bucket
3. Click the **three dots** (⋮) next to it
4. Click **Edit bucket**
5. Check **"Public bucket"** checkbox
6. Click **Save**

That's it! No policies needed.

## Solution 2: Set Up RLS Policies (More Secure - 5 minutes)

If you want to keep receipts private:

1. Go to Supabase Dashboard → **Storage** → **receipts** bucket
2. Click the **"Policies"** tab
3. Click **"New Policy"**

### Create This Policy:

**Policy Name:** `Users can manage their own receipts`

**Allowed Operations:** Check all: SELECT, INSERT, DELETE

**Policy Definition:** Use this SQL:
```sql
bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
```

4. Click **Review** then **Save policy**

Done! This single policy allows users to upload, view, and delete only their own receipts.

## Verify It Works

1. Try uploading a receipt photo again
2. Check the browser console - the error should be gone
3. The receipt thumbnail should appear in your transaction list

## Still Having Issues?

- Make sure you're logged in
- Check that the bucket name is exactly `receipts` (lowercase)
- Try refreshing the page after creating the bucket/policies
- Check browser console for any other errors

