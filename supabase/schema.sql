-- The Syndicate — Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Games table: populated from The Odds API
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,          -- Odds API game ID
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  favorite TEXT,
  underdog TEXT,
  commence_time TIMESTAMPTZ NOT NULL,
  round TEXT NOT NULL DEFAULT 'r64',          -- r64, r32, s16, e8, f4, champ
  -- Current lines (updated from API)
  spread TEXT,
  spread_odds TEXT,
  total TEXT,
  over_odds TEXT,
  under_odds TEXT,
  fav_ml TEXT,
  dog_ml TEXT,
  -- Final score (updated from API after game ends)
  home_score INTEGER,
  away_score INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bets table: group bets placed on games
CREATE TABLE bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL DEFAULT 'straight',  -- straight, parlay
  wager NUMERIC NOT NULL,
  result TEXT,                                 -- win, loss, push, null (pending)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bet legs: individual picks within a bet (1 for straight, 2+ for parlay)
CREATE TABLE bet_legs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                         -- e.g. "Purdue -6.5", "Over 153.5"
  odds TEXT NOT NULL,                          -- American odds e.g. "-110", "+350"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments: friend commentary on games
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL,                     -- jason, zock, justin
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, friend_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_games_round ON games(round);
CREATE INDEX idx_games_commence ON games(commence_time);
CREATE INDEX idx_bets_game ON bets(game_id);
CREATE INDEX idx_bet_legs_bet ON bet_legs(bet_id);
CREATE INDEX idx_comments_game ON comments(game_id);

-- Enable Row Level Security (open for now — we'll add auth later if needed)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth required for 3-4 friends)
CREATE POLICY "Allow all on games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on bets" ON bets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on bet_legs" ON bet_legs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on comments" ON comments FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bets_updated_at BEFORE UPDATE ON bets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
