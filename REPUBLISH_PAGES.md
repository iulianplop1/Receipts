# How to Republish GitHub Pages

## Step-by-Step Instructions

### Step 1: Enable GitHub Pages

1. Go to your repository: https://github.com/iulianplop1/Receipts
2. Click on **Settings** (top menu bar)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, you'll see options

### Step 2: Select GitHub Actions

1. In the **Source** dropdown, select: **GitHub Actions**
2. **DO NOT** select "Deploy from a branch"
3. Click **Save**

### Step 3: Verify GitHub Secrets

1. Still in Settings, click **Secrets and variables** → **Actions**
2. Make sure these 3 secrets exist:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`
3. If any are missing, click **New repository secret** and add them

### Step 4: Trigger Deployment

You have two options:

**Option A: Push any change**
```bash
git add .
git commit -m "Republish GitHub Pages"
git push origin main
```

**Option B: Manually trigger workflow**
1. Go to: https://github.com/iulianplop1/Receipts/actions
2. Click on **Deploy to GitHub Pages** workflow
3. Click **Run workflow** button (top right)
4. Select branch: **main**
5. Click **Run workflow**

### Step 5: Wait for Deployment

1. Go to the **Actions** tab
2. Watch the workflow run (it will show "Deploy to GitHub Pages")
3. Wait for it to complete (green checkmark)
4. This usually takes 1-2 minutes

### Step 6: Access Your Site

After the workflow completes:
- Wait 1-2 more minutes for GitHub Pages to update
- Visit: https://iulianplop1.github.io/Receipts/
- Clear browser cache if needed (Ctrl+Shift+R)

## What Should Happen

✅ The workflow will:
1. Build your app with `npm run build`
2. Create the `dist/` folder with built files
3. Deploy the `dist/` folder to GitHub Pages
4. Your site will be live at the URL above

## Troubleshooting

**If the workflow fails:**
- Check the error message in the Actions tab
- Make sure all 3 secrets are set correctly
- Make sure the `base: '/Receipts/'` is in `vite.config.js`

**If the site is still blank:**
- Make sure Pages Source is set to "GitHub Actions" (not a branch)
- Wait a few minutes for propagation
- Try incognito/private mode to rule out cache

## Quick Checklist

- [ ] Pages Source = "GitHub Actions"
- [ ] All 3 secrets are set
- [ ] Workflow has run successfully (green checkmark)
- [ ] Waited 1-2 minutes after workflow completion
- [ ] Cleared browser cache

Your site should now be live! 🚀

