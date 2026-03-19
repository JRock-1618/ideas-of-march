import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchGames, transformGame } from '@/lib/odds-api';

// 2026 NCAA Tournament field (68 teams) — full names as used by The Odds API
const TOURNAMENT_TEAMS = [
  // 1 seeds
  "Duke Blue Devils", "Michigan Wolverines", "Arizona Wildcats", "Florida Gators",
  // 2 seeds
  "Houston Cougars", "Purdue Boilermakers", "Iowa State Cyclones", "Connecticut Huskies",
  "St. John's Red Storm", "Tennessee Volunteers", "Alabama Crimson Tide", "Michigan State Spartans",
  // 3 seeds
  "Illinois Fighting Illini", "Wisconsin Badgers", "Gonzaga Bulldogs", "Virginia Cavaliers",
  "Kentucky Wildcats", "Texas Tech Red Raiders",
  // 4 seeds
  "Arkansas Razorbacks", "Nebraska Cornhuskers", "Kansas Jayhawks", "Maryland Terrapins",
  "Arizona State Sun Devils",
  // 5 seeds
  "St. John's Red Storm", "Vanderbilt Commodores", "Clemson Tigers", "Michigan Wolverines",
  "Oregon Ducks", "Memphis Tigers",
  // 6 seeds
  "BYU Cougars", "Louisville Cardinals", "Tennessee Volunteers", "North Carolina Tar Heels",
  "Ole Miss Rebels", "Missouri Tigers",
  // 7 seeds
  "UCLA Bruins", "Saint Mary's Gaels", "Miami Hurricanes", "Kansas Jayhawks",
  "Marquette Golden Eagles",
  // 8 seeds
  "Ohio State Buckeyes", "Gonzaga Bulldogs", "Georgia Bulldogs", "Clemson Tigers",
  "Villanova Wildcats", "UConn Huskies", "Louisville Cardinals",
  // 9 seeds
  "TCU Horned Frogs", "Utah State Aggies", "Iowa Hawkeyes", "Saint Louis Billikens",
  "Baylor Bears", "Creighton Bluejays", "Oklahoma Sooners",
  // 10 seeds
  "Texas A&M Aggies", "Santa Clara Broncos", "UCF Knights", "Missouri Tigers",
  "New Mexico Lobos", "Arkansas Razorbacks",
  // 11 seeds
  "VCU Rams", "South Florida Bulls", "Texas Longhorns", "NC State Wolfpack", "SMU Mustangs",
  "Drake Bulldogs", "Miami (OH) RedHawks",
  // 12 seeds
  "McNeese Cowboys", "Northern Iowa Panthers", "Akron Zips", "High Point Panthers",
  "Liberty Flames", "UCSD Tritons", "Colorado State Rams",
  // 13 seeds
  "Hofstra Pride", "Troy Trojans", "Hawaii Rainbow Warriors", "Hawai'i Rainbow Warriors", "California Baptist Lancers",
  "Grand Canyon Antelopes", "Lipscomb Bisons", "Yale Bulldogs",
  // 14 seeds
  "North Dakota State Bison", "Kennesaw State Owls", "Wright State Raiders", "Penn Quakers",
  // 15 seeds
  "Furman Paladins", "Tennessee State Tigers", "Queens Royals", "Idaho Vandals",
  "Wofford Terriers", "Bryant Bulldogs", "Robert Morris Colonials", "Omaha Mavericks",
  // 16 seeds
  "Long Island Sharks", "Siena Saints", "Lehigh Mountain Hawks", "Howard Bison",
  "Prairie View A&M Panthers", "UMBC Retrievers",
  "Norfolk State Spartans", "Alabama State Hornets", "Mount St. Mary's Mountaineers",
  "Montana Grizzlies",
];

// Create a Set for fast lookup with normalized names
function normalize(s) { return s.toLowerCase().replace(/[''ʻ]/g, '').replace(/[^a-z0-9 ]/g, '').trim(); }
const TOURNEY_SET = new Set(TOURNAMENT_TEAMS.map(normalize));

function isTournamentTeam(teamName) {
  if (!teamName) return false;
  const norm = normalize(teamName);
  // Exact match
  if (TOURNEY_SET.has(norm)) return true;
  // Partial: match on first word + last word
  for (const t of TOURNEY_SET) {
    const tFirst = t.split(' ')[0];
    const tLast = t.split(' ').slice(-1)[0];
    const nFirst = norm.split(' ')[0];
    const nLast = norm.split(' ').slice(-1)[0];
    if (norm.includes(tFirst) && norm.includes(tLast)) return true;
    if (t.includes(nFirst) && t.includes(nLast)) return true;
  }
  return false;
}

function isTournamentGame(game) {
  return isTournamentTeam(game.home_team) && isTournamentTeam(game.away_team);
}

// Determine tournament round based on date
function detectRound(commenceTime) {
  const d = new Date(commenceTime);
  const month = d.getMonth() + 1;
  const day = d.getDate();

  if (month === 3 && day <= 19) return 'r64'; // First Four + R64 Day 1
  if (month === 3 && day <= 21) return 'r64';
  if (month === 3 && day <= 23) return 'r32';
  if (month === 3 && day <= 28) return 's16';
  if (month === 3 && day <= 30) return 'e8';
  if (month === 4 && day <= 5) return 'f4';
  return 'champ';
}

export async function POST() {
  try {
    const rawGames = await fetchGames();

    // Filter to tournament games only
    const tourneyGames = rawGames.filter(isTournamentGame);

    const games = tourneyGames.map(raw => {
      const transformed = transformGame(raw);
      transformed.round = detectRound(raw.commence_time);
      return transformed;
    });

    // Upsert into Supabase
    let synced = 0;
    for (const game of games) {
      const { error } = await supabase
        .from('games')
        .upsert({
          external_id: game.external_id,
          home_team: game.home_team,
          away_team: game.away_team,
          favorite: game.favorite,
          underdog: game.underdog,
          commence_time: game.commence_time,
          round: game.round,
          spread: game.spread,
          spread_odds: game.spread_odds,
          total: game.total,
          over_odds: game.over_odds,
          under_odds: game.under_odds,
          fav_ml: game.fav_ml,
          dog_ml: game.dog_ml,
        }, { onConflict: 'external_id' });

      if (error) console.error('Upsert error:', error);
      else synced++;
    }

    return NextResponse.json({
      synced,
      totalFromApi: rawGames.length,
      filteredToTourney: tourneyGames.length,
    });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
