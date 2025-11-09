# GitHub Pages Deployment Guide

## ✅ Yes, it will work!

Your app is a **static site** (React/Vite) that uses client-side APIs. GitHub Pages can host static sites perfectly - **no server needed!**

Everything runs in the user's browser:
- ✅ Gemini API calls (from browser)
- ✅ Supabase database (from browser)
- ✅ Audio recording (from browser)
- ✅ All features work client-side

## Step-by-Step Deployment

### 1. Vite Config ✅ (Already Configured!)

The `vite.config.js` is already set up with the correct base path for your repository:

```js
base: '/Receipts/',
```

This matches your repository name and GitHub Pages URL.

### 2. Set Up GitHub Secrets

Your API keys need to be stored as GitHub Secrets (they're safe and encrypted):

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these three secrets:

   - **Name:** `VITE_SUPABASE_URL`
     **Value:** `https://mzsafoaevlampvzqrrmz.supabase.co`

   - **Name:** `VITE_SUPABASE_ANON_KEY`
     **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16c2Fmb2FldmxhbXB2enFycm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTA0NDIsImV4cCI6MjA3ODI2NjQ0Mn0.XBPGs_C2VPp4TPACagJ85cdzkFJAv0WZ58R6_2wPww8`

   - **Name:** `VITE_GEMINI_API_KEY`
     **Value:** `AIzaSyDRkO31dq3n5R5KUFVbLgEXQF9yXrx455c`

### 3. Enable GitHub Pages

1. Go to your repository **Settings**
2. Scroll to **Pages** (left sidebar)
3. Under **Source**, select **GitHub Actions**
4. Save

### 4. Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 5. Deploy Automatically

Once you push to `main`, GitHub Actions will:
1. ✅ Build your app
2. ✅ Use your secrets for environment variables
3. ✅ Deploy to GitHub Pages automatically

Check the **Actions** tab in your repo to see the deployment progress.

### 6. Access Your App

Your app will be available at:
```
https://iulianplop1.github.io/Receipts/
```

🎉 Your deployment is ready!

## Troubleshooting

### If deployment fails:
1. Check the **Actions** tab for error messages
2. Make sure all 3 secrets are set correctly
3. Verify the `base` path in `vite.config.js` matches your repo name

### If the app doesn't load:
1. Check browser console for errors
2. Verify environment variables are being used (they're embedded in the build)
3. Make sure GitHub Pages is enabled and using GitHub Actions

## Security Note

⚠️ **Important:** Your API keys will be embedded in the built JavaScript files. This is normal for client-side apps, but:
- ✅ Supabase anon key is safe to expose (it's public by design)
- ✅ Gemini API key will be visible in the code
- Consider setting up API key restrictions in Google Cloud Console if needed

## Alternative: Use Environment Variables at Runtime

If you want to keep API keys more secure, you could:
1. Use a backend proxy (requires a server)
2. Use environment variable injection at build time (current approach - works great!)

Your current setup is perfect for GitHub Pages! 🚀

