'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { shortName } from './teams';

// Fetch all games with bets and comments
export function useGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data: gamesData } = await supabase
      .from('games')
      .select('*, bets(*, bet_legs(*)), comments(*)')
      .order('commence_time', { ascending: true });

    if (gamesData) {
      const transformed = gamesData.map(g => {
        const favShort = shortName(g.favorite);
        const dogShort = shortName(g.underdog);
        const homeShort = shortName(g.home_team);
        const awayShort = shortName(g.away_team);

        return {
          id: g.id,
          matchup: `${favShort} vs ${dogShort}`,
          api: {
            f: favShort, d: dogShort,
            fFull: g.favorite, dFull: g.underdog,
            sp: g.spread || '', so: g.spread_odds || '-110',
            ou: g.total || '', oo: g.over_odds || '-110', ou2: g.under_odds || '-110',
            fm: g.fav_ml || '', dm: g.dog_ml || '',
          },
          round: g.round,
          commence_time: g.commence_time,
          completed: g.completed || false,
          home_team: homeShort,
          away_team: awayShort,
          home_score: g.home_score,
          away_score: g.away_score,
          // Figure out which score belongs to fav/dog
          fav_score: g.home_team === g.favorite ? g.home_score : g.away_score,
          dog_score: g.home_team === g.favorite ? g.away_score : g.home_score,
          bets: (g.bets || []).map(b => ({
            id: b.id,
            type: b.bet_type,
            wager: Number(b.wager),
            result: b.result,
            legs: (b.bet_legs || []).map(l => ({
              label: l.label,
              odds: l.odds,
              gid: l.game_id,
            })),
          })),
          comments: (g.comments || []).reduce((acc, c) => {
            acc[c.friend_id] = c.content;
            return acc;
          }, { jason: '', zock: '', justin: '' }),
        };
      });

      setGames(transformed);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('all-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_legs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { games, loading, refetch: fetchAll };
}

// Add a bet
export async function addBet(gameId, betType, wager, legs) {
  const res = await fetch('/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, bet_type: betType, wager, legs }),
  });
  return res.json();
}

// Update bet result
export async function updateBetResult(betId, result) {
  const res = await fetch('/api/bets', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: betId, result }),
  });
  return res.json();
}

// Update comment
export async function updateComment(gameId, friendId, content) {
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, friend_id: friendId, content }),
  });
  return res.json();
}

// Trigger game sync
export async function syncGames() {
  const res = await fetch('/api/sync-games', { method: 'POST' });
  return res.json();
}

// Trigger score sync
export async function syncScores() {
  const res = await fetch('/api/sync-scores', { method: 'POST' });
  return res.json();
}
