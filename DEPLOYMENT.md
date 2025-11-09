# Deployment Guide

## GitHub Pages Deployment

### Option 1: Manual Deployment

1. Build the project:
```bash
npm run build
```

2. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

3. Add to `package.json` scripts:
```json
"deploy": "npm run build && gh-pages -d dist"
```

4. Update `vite.config.js` to set base path:
```js
export default defineConfig({
  base: '/your-repo-name/',
  plugins: [react()],
  // ...
})
```

5. Deploy:
```bash
npm run deploy
```

### Option 2: GitHub Actions (Automated)

The `.github/workflows/deploy.yml` file is already configured for automatic deployment.

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`

4. Push to the `main` branch - deployment will happen automatically!

### Important Notes

- Update the `base` path in `vite.config.js` to match your repository name
- Make sure all environment variables are set as GitHub Secrets
- The app will be available at `https://yourusername.github.io/your-repo-name/`

## Other Hosting Options

### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Add environment variables in Vercel dashboard

### Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Add environment variables in Netlify dashboard

### Supabase Hosting

You can also host directly on Supabase:
1. Go to your Supabase project
2. Navigate to Storage or use Supabase Edge Functions
3. Upload the built `dist` folder

