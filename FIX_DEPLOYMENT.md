# Fix for Blank Page / 404 Errors

## Problem
The site is showing a blank page because GitHub Pages is serving the **source files** instead of the **built files**.

## Solution

### Step 1: Verify GitHub Secrets are Set
Go to: https://github.com/iulianplop1/Receipts/settings/secrets/actions

Make sure these 3 secrets exist:
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`  
- ✅ `VITE_GEMINI_API_KEY`

### Step 2: Verify GitHub Pages Settings
Go to: https://github.com/iulianplop1/Receipts/settings/pages

**Source should be:** `GitHub Actions` (NOT "Deploy from a branch")

### Step 3: Trigger a New Deployment

Push these changes to trigger a fresh build:

```bash
git add .
git commit -m "Fix deployment - ensure built files are deployed"
git push origin main
```

### Step 4: Check GitHub Actions

1. Go to: https://github.com/iulianplop1/Receipts/actions
2. Click on the latest workflow run
3. Make sure it completes successfully (green checkmark)
4. If it fails, check the error messages

### Step 5: Wait for Deployment

After the workflow completes:
- Wait 1-2 minutes for GitHub Pages to update
- Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Visit: https://iulianplop1.github.io/Receipts/

## What Should Happen

The built `index.html` should have:
```html
<script type="module" crossorigin src="/Receipts/assets/index-XXXXX.js"></script>
```

NOT:
```html
<script type="module" src="/src/main.jsx"></script>
```

## If Still Not Working

1. **Check the Actions tab** - Is the build succeeding?
2. **Check the Pages settings** - Is it set to "GitHub Actions"?
3. **Check browser console** - What exact errors do you see?
4. **Try incognito/private mode** - Rule out cache issues

## Manual Verification

You can verify the build works locally:
```bash
npm run build
```

Then check `dist/index.html` - it should have the correct asset paths with `/Receipts/` prefix.

