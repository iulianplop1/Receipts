# 🔧 Fix Storage Error - Step by Step

You're seeing this error because the storage bucket needs to be set up. **Don't worry - your transactions are still being saved!** The receipt images just won't upload until this is fixed.

## ⚡ Quick Fix (2 minutes)

### Step 1: Go to Supabase Storage
1. Open your Supabase project dashboard
2. Click **"Storage"** in the left sidebar
3. You should see a list of buckets (or it might be empty)

### Step 2: Check if "receipts" bucket exists
- **If you see a bucket named `receipts`**: Go to Step 3
- **If you DON'T see a bucket named `receipts`**: 
  - Click **"New bucket"** button
  - Name it: `receipts` (exactly, lowercase)
  - **Check the box "Public bucket"** ✅
  - Click **"Create bucket"**
  - Done! Skip to Step 4

### Step 3: Make existing bucket public
1. Find the `receipts` bucket in the list
2. Click the **three dots (⋮)** on the right side of the bucket row
3. Click **"Edit bucket"**
4. **Check the box "Public bucket"** ✅
5. Click **"Save"**

### Step 4: Test it!
1. Go back to your app
2. Try scanning a receipt photo again
3. The error should be gone! ✅

---

## 🔒 Alternative: Keep Bucket Private (More Secure)

If you want to keep receipts private instead of making the bucket public:

1. Go to **Storage** → **receipts** bucket
2. Click the **"Policies"** tab
3. Click **"New Policy"** button
4. Fill in:
   - **Policy name**: `Users can manage their own receipts`
   - **Allowed operations**: Check ✅ **SELECT**, ✅ **INSERT**, ✅ **DELETE**
   - **Policy definition**: Copy and paste this:
   ```sql
   bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
   ```
5. Click **"Review"** then **"Save policy"**

---

## ✅ Verify It's Working

After setting up the bucket:
1. Refresh your app
2. Try adding a transaction with a receipt photo
3. Check the browser console - no more errors!
4. The receipt thumbnail should appear next to your transaction

---

## ❓ Still Not Working?

**Check these:**
- ✅ Bucket name is exactly `receipts` (lowercase, no spaces)
- ✅ "Public bucket" is checked (if using public method)
- ✅ You're logged in to your app
- ✅ You refreshed the page after creating the bucket
- ✅ Check browser console for any other errors

**If you're using the private method:**
- ✅ Policy is saved and enabled
- ✅ All three operations (SELECT, INSERT, DELETE) are checked
- ✅ The SQL policy matches exactly (copy-paste it)

---

## 💡 What This Does

- **Public bucket**: Anyone with the URL can view receipts (simpler, less secure)
- **Private bucket + policies**: Only you can see your own receipts (more secure, requires setup)

For most personal use, **public bucket is fine** and much easier to set up!

