# 360° Report Generator

AI-powered 360 feedback report generator. HR uploads an Excel file → Claude analyzes it → formatted report ready to save as PDF.

## Project Structure

```
360-generator/
├── index.html        ← Frontend app
├── api/
│   └── generate.js   ← Vercel serverless function (holds API key securely)
├── vercel.json       ← Routing config
├── package.json
└── README.md
```

## Deploy to Vercel (5 minutes)

### Step 1 — Push to GitHub

1. Create a new repo on github.com (e.g. `360-report-generator`)
2. Push this folder:

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/360-report-generator.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to vercel.com → New Project
2. Import your GitHub repo
3. Click Deploy (no build settings needed)

### Step 3 — Add your Anthropic API key

1. In Vercel dashboard → your project → Settings → Environment Variables
2. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-...` (your key from console.anthropic.com)
3. Click Save → go to Deployments → Redeploy (to pick up the env var)

Done. Share the Vercel URL with HR — no API key needed on their end.

## How it works

- HR visits the URL, uploads a `.xlsx` 360 feedback file
- Enters employee name, title, review period
- Clicks Generate → the browser calls `/api/generate` (your Vercel function)
- The function calls Anthropic using your server-side API key (never exposed to the browser)
- Claude parses and analyzes the data, returns structured JSON
- The app renders a formatted report
- HR clicks Print → Save as PDF

## Cost

Each report costs approximately $0.01–0.03 in Anthropic API credits.
Monitor usage at console.anthropic.com → Usage.

## Optional: Restrict Access

To prevent public use, add HTTP Basic Auth via Vercel middleware, or use Vercel's built-in password protection (Pro plan).
