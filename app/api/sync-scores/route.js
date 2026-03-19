import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchScores } from '@/lib/odds-api';

export async function POST() {
  try {
    const rawScores = await fetchScores();
    let updated = 0;
    let autoResolved = 0;

    for (const game of rawScores) {
      if (!game.completed) continue;

      const homeScore = game.scores?.find(s => s.name === game.home_team)?.score;
      const awayScore = game.scores?.find(s => s.name === game.away_team)?.score;

      if (homeScore == null || awayScore == null) continue;

      // Update game with final score
      const { data: dbGame, error } = await supabase
        .from('games')
        .update({
          home_score: Number(homeScore),
          away_score: Number(awayScore),
          completed: true,
        })
        .eq('external_id', game.id)
        .select()
        .single();

      if (error || !dbGame) continue;
      updated++;

      // Auto-resolve bets for this game
      const { data: bets } = await supabase
        .from('bets')
        .select('*, bet_legs(*)')
        .eq('game_id', dbGame.id)
        .is('result', null);

      if (!bets) continue;

      for (const bet of bets) {
        // Only auto-resolve single-leg straight bets on this game
        if (bet.bet_type !== 'straight' || bet.bet_legs.length !== 1) continue;

        const leg = bet.bet_legs[0];
        const result = resolveleg(leg, dbGame);

        if (result) {
          await supabase.from('bets').update({ result }).eq('id', bet.id);
          autoResolved++;
        }
      }
    }

    return NextResponse.json({ updated, autoResolved });
  } catch (err) {
    console.error('Score sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function resolveLeg(leg, game) {
  const label = leg.label.toLowerCase();
  const homeScore = game.home_score;
  const awayScore = game.away_score;
  const totalScore = homeScore + awayScore;
  const fav = game.favorite;
  const dog = game.underdog;
  const spread = Number(game.spread);

  // Determine which team is home/away
  const favIsHome = game.home_team === fav;
  const favScore = favIsHome ? homeScore : awayScore;
  const dogScore = favIsHome ? awayScore : homeScore;

  // Spread bets
  if (label.includes(fav.toLowerCase()) && label.match(/-?\d+\.?\d*/)) {
    const pts = Number(label.match(/-?\d+\.?\d*/)[0]);
    const margin = favScore - dogScore;
    if (margin + pts > 0) return 'win';
    if (margin + pts < 0) return 'loss';
    return 'push';
  }
  if (label.includes(dog.toLowerCase()) && label.match(/\+\d+\.?\d*/)) {
    const pts = Number(label.match(/\+(\d+\.?\d*)/)[1]);
    const margin = dogScore - favScore;
    if (margin + pts > 0) return 'win';
    if (margin + pts < 0) return 'loss';
    return 'push';
  }

  // Moneyline bets
  if (label.includes('ml') || label.includes('moneyline')) {
    if (label.includes(fav.toLowerCase())) return favScore > dogScore ? 'win' : 'loss';
    if (label.includes(dog.toLowerCase())) return dogScore > favScore ? 'win' : 'loss';
  }

  // Over/Under
  if (label.includes('over') && label.match(/\d+\.?\d*/)) {
    const line = Number(label.match(/(\d+\.?\d*)/)[1]);
    if (totalScore > line) return 'win';
    if (totalScore < line) return 'loss';
    return 'push';
  }
  if (label.includes('under') && label.match(/\d+\.?\d*/)) {
    const line = Number(label.match(/(\d+\.?\d*)/)[1]);
    if (totalScore < line) return 'win';
    if (totalScore > line) return 'loss';
    return 'push';
  }

  // Can't auto-resolve (props, custom, etc.)
  return null;
}

export async function GET() {
  return POST();
}
