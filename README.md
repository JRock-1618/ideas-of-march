# The Syndicate — March Madness Betting Tracker

A collaborative NCAA tournament betting tracker for you and the crew. Live lines from The Odds API, real-time sync via Supabase, deployed on Vercel.

## Quick Start

### 1. Set up Supabase (5 min)

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project** — name it "syndicate" or whatever you want
3. Pick a region close to you (East US is fine), set a database password, click **Create**
4. Wait ~2 min for the project to spin up
5. Go to **SQL Editor** (left sidebar) → **New Query**
6. Open `supabase/schema.sql` from this project, copy the entire contents, paste it into the query editor
7. Click **Run** — you should see "Success" for each statement
8. Go to **Project Settings** (gear icon) → **API**
9. Copy your **Project URL** and **anon public** key — you'll need these next

### 2. Get The Odds API key (2 min)

1. Go to [the-odds-api.com](https://the-odds-api.com)
2. Sign up for an account
3. Pick the **$20/month** plan (or start with free to test — 500 requests)
4. Copy your API key from the dashboard

### 3. Set up the project locally

```bash
# Clone or unzip the project
cd syndicate-app

# Install dependencies
npm install

# Create your environment file
cp .env.local.example .env.local
```

Edit `.env.local` with your keys:
```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
ODDS_API_KEY=abc123...
```

```bash
# Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Sync your first games

With the app running, hit these endpoints to pull in data:

```
http://localhost:3000/api/sync-games    # Pull games + lines from The Odds API
http://localhost:3000/api/sync-scores   # Pull scores + auto-resolve bets
```

### 5. Deploy to Vercel (3 min)

1. Push the project to a GitHub repo
2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Click **Import Project** → select your repo
4. Add your 3 environment variables (same as `.env.local`)
5. Click **Deploy**
6. Share the URL with Zock and Justin

### 6. Set up auto-sync (optional)

To keep games and scores updating automatically, add Vercel Cron Jobs.

Create `vercel.json` in the project root:
```json
{
  "crons": [
    { "path": "/api/sync-games", "schedule": "*/15 * * * *" },
    { "path": "/api/sync-scores", "schedule": "*/5 * * * *" }
  ]
}
```

This syncs games every 15 min and scores every 5 min during the tournament.

---

## Project Structure

```
syndicate-app/
├── app/
│   ├── layout.js              # Root HTML layout
│   ├── page.js                # Main page (imports App component)
│   └── api/
│       ├── sync-games/        # Pull games + lines from Odds API → Supabase
│       ├── sync-scores/       # Pull scores, auto-resolve bets
│       ├── bets/              # CRUD for bets + legs
│       └── comments/          # CRUD for friend comments
├── components/
│   └── App.jsx                # Full UI (tracker + history pages)
├── lib/
│   ├── supabase.js            # Supabase client
│   ├── odds-api.js            # Odds API client + transformers
│   ├── odds.js                # Math utilities (payout, parlay, ROI)
│   ├── constants.js           # Friends, rounds, historical data
│   └── hooks.js               # React hooks for data fetching + real-time
├── supabase/
│   └── schema.sql             # Database schema — run this in Supabase SQL Editor
├── .env.local.example         # Environment variables template
├── next.config.js
├── package.json
└── README.md
```

## How it works

**Data flow:**
1. The Odds API → `/api/sync-games` → Supabase `games` table (lines update every 15 min)
2. The Odds API → `/api/sync-scores` → Supabase `games` table (scores) + auto-resolves simple bets
3. You + friends → UI → `/api/bets` + `/api/comments` → Supabase
4. Supabase real-time → pushes updates to all connected browsers instantly

**Auto-resolve logic:**
- Spread bets: checks final margin vs line
- Moneyline: checks winner
- Over/Under: checks total score vs line
- Props/parlays/custom: manual Win/Loss/Push toggle

**Currently static (next upgrade):**
The App.jsx component currently uses hardcoded sample data from the 2025 tournament. To wire it to live Supabase data, replace the `INIT` data and state management with the hooks from `lib/hooks.js`. The hooks are ready — they fetch from Supabase and subscribe to real-time updates.

## Supabase Real-Time

The app subscribes to all table changes. When Zock places a bet on his phone, Justin and Jason see it appear instantly on theirs. No refresh needed.

To enable real-time in Supabase:
1. Go to **Database** → **Replication**
2. Enable replication for: `games`, `bets`, `bet_legs`, `comments`

## Costs

- **Supabase**: Free tier (500MB database, 50k monthly active users)
- **The Odds API**: $20/month during tournament (~2 weeks)
- **Vercel**: Free tier (hobby plan)
- **Total**: ~$20 for the tournament
