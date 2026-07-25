# Portfolio Tracker — Setup Guide

Get your tracker live in ~15 minutes. You need 3 free accounts.

---

## Step 1 — Create a GitHub account

1. Go to **github.com** → Sign up (use your Google account for speed)
2. Create a new repository: click **+** → **New repository**
3. Name it `portfolio-tracker`, set to **Public**, click **Create repository**
4. Upload all the project files into this repo (drag and drop on GitHub)

---

## Step 2 — Create a Supabase account (your database)

1. Go to **supabase.com** → Sign in with GitHub (1 click)
2. Click **New project** → give it a name like `portfolio` → set a database password → **Create project** (takes ~2 min)
3. Once ready, go to **SQL Editor** (left sidebar)
4. Paste the contents of `supabase/schema.sql` and click **Run** — this creates your tables
5. Go to **Settings → API**
6. Copy your **Project URL** and **anon public key** — you'll need these in Step 3

---

## Step 3 — Deploy to Vercel

1. Go to **vercel.com** → Sign in with GitHub (1 click)
2. Click **Add New Project** → Import your `portfolio-tracker` GitHub repo
3. Before deploying, click **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy** — done in ~1 minute
5. Vercel gives you a URL like `portfolio-tracker-xxx.vercel.app` — this is your site!

---

## Using the tracker

### Add a policy
1. Open your site → click **+ ADD POLICY**
2. Enter: Policy Number, Nickname, Product, Commenced Date, Premium, Total Invested
3. Add fund holdings: select each fund from the dropdown, enter units held, and avg price paid

### Update fund prices
- On the main page or any policy page, click **↻ Fetch live prices** — this tries to pull from Great Eastern's website automatically
- If auto-fetch doesn't work (GE's page is JavaScript-rendered), click **Edit holdings** on the policy page and enter the current price manually in the **Avg / Manual Price** field, then save

### Update units after a fund switch
1. Go to the policy page → click **Edit holdings**
2. Update the units for each fund (or add/remove funds)
3. Click **Save Holdings**

---

## Future updates

Every time you push code changes to GitHub, Vercel auto-deploys — no manual steps needed.

---

## Questions?

The tracker calculates:
- **AUM** = sum of (units × current price) across all funds
- **ROI** = (AUM − Total Invested) / Total Invested × 100
- **XIRR** = estimated annualised return (CAGR from commencement date to today)
