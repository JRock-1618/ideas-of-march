import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET — fetch all bets with legs for a game or all games
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('game_id');

  let query = supabase.from('bets').select('*, bet_legs(*)').order('created_at', { ascending: true });
  if (gameId) query = query.eq('game_id', gameId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create a new bet with legs
export async function POST(request) {
  const body = await request.json();
  const { game_id, bet_type, wager, legs } = body;

  // Insert bet
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({ game_id, bet_type, wager })
    .select()
    .single();

  if (betError) return NextResponse.json({ error: betError.message }, { status: 500 });

  // Insert legs
  const legRows = legs.map(leg => ({
    bet_id: bet.id,
    game_id: leg.game_id || game_id,
    label: leg.label,
    odds: leg.odds,
  }));

  const { error: legError } = await supabase.from('bet_legs').insert(legRows);
  if (legError) return NextResponse.json({ error: legError.message }, { status: 500 });

  // Return full bet with legs
  const { data: fullBet } = await supabase
    .from('bets')
    .select('*, bet_legs(*)')
    .eq('id', bet.id)
    .single();

  return NextResponse.json(fullBet);
}

// PATCH — update bet result (win/loss/push)
export async function PATCH(request) {
  const body = await request.json();
  const { id, result } = body;

  const { data, error } = await supabase
    .from('bets')
    .update({ result })
    .eq('id', id)
    .select('*, bet_legs(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — remove a bet
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const { error } = await supabase.from('bets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
