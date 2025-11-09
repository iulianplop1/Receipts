# Setup Guide for New Features

This guide explains how to set up the three new features that have been added to the Budget Tracker app.

## 1. Receipt Photo Storage

### Database Setup
Run this SQL in your Supabase SQL Editor to add the receipt_image_url column:

```sql
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;
```

### Storage Bucket Setup
1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Name it `receipts`
5. **IMPORTANT**: Choose one of these options:
   - **Option A (Easiest)**: Make it **Public** - Check the "Public bucket" checkbox
   - **Option B (More Secure)**: Keep it private and set up RLS policies (see below)
6. Click **Create bucket**

### Storage Policies (REQUIRED if bucket is Private)
If you did NOT make the bucket public, you MUST create these policies in **Storage > Policies**:

**Step 1: Go to Storage > Policies**
- Click on the `receipts` bucket
- Click on "Policies" tab
- Click "New Policy"

**Policy 1: Users can upload their own receipts**
- Policy name: "Users can upload their own receipts"
- Allowed operation: INSERT
- Policy definition: Use this SQL:
```sql
bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
```

**Policy 2: Users can view their own receipts**
- Policy name: "Users can view their own receipts"
- Allowed operation: SELECT
- Policy definition: Use this SQL:
```sql
bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
```

**Policy 3: Users can delete their own receipts**
- Policy name: "Users can delete their own receipts"
- Allowed operation: DELETE
- Policy definition: Use this SQL:
```sql
bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
```

**Alternative: If you want to make it simpler, use this single policy for all operations:**
- Policy name: "Users can manage their own receipts"
- Allowed operations: SELECT, INSERT, DELETE
- Policy definition:
```sql
bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
```

### Quick Fix for RLS Errors
If you're getting RLS policy errors:
1. **Easiest solution**: Delete the bucket and recreate it as **Public**
2. **Or**: Make sure all three policies above are created correctly
3. **Or**: Use the single combined policy for all operations

### How It Works
- When you scan a receipt photo, the image is automatically uploaded to Supabase Storage
- The receipt image URL is saved with the transaction
- You can click on the receipt thumbnail in the transaction list to view the full image

## 2. Recurring Subscriptions

### Setup
No additional setup required! The feature is ready to use.

### How to Use
1. Click the **"+ Add Subscription"** button in the Subscriptions card
2. Fill in:
   - Service Name (e.g., "Netflix")
   - Amount
   - Currency
   - Frequency (Monthly, Yearly, or Weekly)
3. Click **Add Subscription**
4. Toggle subscriptions active/inactive as needed
5. Delete subscriptions you no longer have

### Features
- Add subscriptions manually (like Netflix, Spotify, etc.)
- Track monthly/yearly/weekly subscriptions
- Toggle subscriptions active/inactive
- Delete subscriptions
- View subscription costs in your selected currency

## 3. Export Data

### Setup
No additional setup required! The feature is ready to use.

### How to Use
1. Click the **"📥 Export"** button in the dashboard header
2. Choose your export format:
   - **Export as JSON**: Exports all data (transactions, budgets, subscriptions) in a single JSON file
   - **Export as CSV**: Exports each data type (transactions, budgets, subscriptions) as separate CSV files

### Export Formats

**JSON Export:**
- Single file: `budget-tracker-export.json`
- Contains: transactions, budgets, subscriptions, and export date
- Best for: Backup, import to other systems, data analysis

**CSV Export:**
- Multiple files: `transactions.csv`, `budgets.csv`, `subscriptions.csv`
- Best for: Opening in Excel/Google Sheets, data analysis, reporting

## Summary of Changes

### Files Created
- `src/lib/storage.js` - Storage utilities for receipt images
- `src/lib/export.js` - Export functionality (CSV/JSON)
- `supabase-schema-update.sql` - Database schema update

### Files Modified
- `src/components/AddExpenseButton.jsx` - Added receipt image upload
- `src/components/TransactionList.jsx` - Added receipt image display
- `src/components/TransactionList.css` - Added receipt thumbnail and modal styles
- `src/components/SubscriptionTracker.jsx` - Added subscription creation UI
- `src/components/SubscriptionTracker.css` - Added subscription form styles
- `src/components/Dashboard.jsx` - Added export button and menu
- `src/components/Dashboard.css` - Added export menu styles
- `src/lib/db.js` - Added deleteSubscription function

### Database Changes
- Added `receipt_image_url` column to `transactions` table

## Testing the Features

1. **Receipt Storage:**
   - Scan a receipt photo
   - Check that the receipt thumbnail appears in the transaction list
   - Click the thumbnail to view the full image

2. **Subscriptions:**
   - Click "+ Add Subscription"
   - Add a test subscription (e.g., "Netflix", $15.99, Monthly)
   - Verify it appears in the subscriptions list
   - Toggle it active/inactive
   - Delete it

3. **Export:**
   - Add some test transactions
   - Click "📥 Export" > "Export as JSON"
   - Verify the JSON file downloads
   - Try CSV export and verify multiple files download

## Troubleshooting

### Receipt Images Not Uploading
- Check that the `receipts` bucket exists in Supabase Storage
- Verify storage policies allow uploads
- Check browser console for errors

### Subscriptions Not Saving
- Check browser console for errors
- Verify database connection
- Ensure user is logged in

### Export Not Working
- Check browser console for errors
- Ensure you have transactions/budgets/subscriptions to export
- Try a different browser if download doesn't start

## Notes

- Receipt images are stored in Supabase Storage and linked to transactions
- Subscriptions can be added manually and tracked separately from transactions
- Export files are downloaded to your default download folder
- All features work offline (except image uploads and exports which require connection)

