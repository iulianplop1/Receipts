# Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account and project
- Gemini API key (already provided)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the SQL script to create all tables and policies

## Step 3: Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=AIzaSyDRkO31dq3n5R5KUFVbLgEXQF9yXrx455c
```

To find your Supabase credentials:
- Go to Project Settings > API
- Copy the "Project URL" for `VITE_SUPABASE_URL`
- Copy the "anon public" key for `VITE_SUPABASE_ANON_KEY`

## Step 4: Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Step 5: Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment.

## Deployment to GitHub Pages

1. Install `gh-pages` package:
```bash
npm install --save-dev gh-pages
```

2. Add to `package.json` scripts:
```json
"deploy": "npm run build && gh-pages -d dist"
```

3. Deploy:
```bash
npm run deploy
```

## Features

- ✅ Receipt photo analysis with AI
- ✅ Voice input (note: requires speech-to-text service for production)
- ✅ Manual text input
- ✅ Budget tracking with visual progress
- ✅ Subscription tracker
- ✅ Intelligent natural language search
- ✅ AI-powered insights
- ✅ Multi-currency support

## Notes

- Audio transcription currently requires a speech-to-text service (like Google Speech-to-Text API) for full functionality
- The app uses Gemini 2.5 Flash for AI features
- All data is stored securely in Supabase with Row Level Security enabled

