# ⚠️ Important: Public Buckets Still Need Policies!

Even though your bucket is **Public**, Supabase still requires **RLS (Row Level Security) policies** for authenticated users to upload files.

**"Public"** means:
- ✅ Files can be accessed via public URLs (anyone can view)
- ❌ **Does NOT** mean authenticated users can upload without policies

## 🔧 Quick Fix: Add a Policy (2 minutes)

### Step 1: Go to Storage Policies
1. In Supabase Dashboard, go to **Storage**
2. Click on the **"receipts"** bucket
3. Click the **"Policies"** tab at the top
4. You should see "0" policies (that's the problem!)

### Step 2: Create the Policy
1. Click **"New Policy"** button
2. Choose **"For full customization"** (or "Create a policy from scratch")
3. Fill in:
   - **Policy name**: `Allow authenticated uploads`
   - **Allowed operations**: Check ✅ **INSERT**, ✅ **SELECT**, ✅ **DELETE**
   - **Policy definition**: Use this SQL:
   ```sql
   bucket_id = 'receipts'
   ```
   (Yes, that's it! Just `bucket_id = 'receipts'` for public buckets)
4. Click **"Review"** then **"Save policy"**

### Step 3: Test
1. Go back to your app
2. Try uploading a receipt photo
3. It should work now! ✅

---

## 🔒 Alternative: User-Specific Policies (More Secure)

If you want users to only access their own receipts:

**Policy definition** (instead of the simple one above):
```sql
bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
```

This ensures users can only upload/view/delete files in their own folder (`userId/filename`).

---

## ✅ Why This Happens

- **Public bucket** = Anyone can view files via URL
- **RLS policies** = Control who can upload/delete files
- Even public buckets need policies for authenticated operations!

---

## 🎯 Summary

**For public buckets with simple access:**
- Policy: `bucket_id = 'receipts'`
- Operations: INSERT, SELECT, DELETE

**For user-specific access:**
- Policy: `bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text`
- Operations: INSERT, SELECT, DELETE

That's it! Once you add the policy, uploads will work. 🚀

