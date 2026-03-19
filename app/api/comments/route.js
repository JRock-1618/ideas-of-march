import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET — fetch comments for a game or all
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('game_id');

  let query = supabase.from('comments').select('*');
  if (gameId) query = query.eq('game_id', gameId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — upsert a comment (create or update)
export async function POST(request) {
  const body = await request.json();
  const { game_id, friend_id, content } = body;

  const { data, error } = await supabase
    .from('comments')
    .upsert(
      { game_id, friend_id, content },
      { onConflict: 'game_id,friend_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
