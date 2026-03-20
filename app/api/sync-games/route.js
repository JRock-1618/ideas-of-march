import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchGames, transformGame } from '@/lib/odds-api';

// 2026 NCAA Tournament field — all known name variants
const TOURNAMENT_TEAMS = [
  "Duke Blue Devils", "Michigan Wolverines", "Arizona Wildcats", "Florida Gators",
  "Houston Cougars", "Purdue Boilermakers", "Iowa State Cyclones", "Connecticut Huskies",
  "UConn Huskies",
  "St. John's Red Storm", "Tennessee Volunteers", "Alabama Crimson Tide",
  "Michigan State Spartans", "Michigan St Spartans",
  "Illinois Fighting Illini", "Wisconsin Badgers", "Gonzaga Bulldogs",
  "Virginia Cavaliers", "Kentucky Wildcats", "Texas Tech Red Raiders",
  "Arkansas Razorbacks", "Nebraska Cornhuskers", "Kansas Jayhawks",
  "Maryland Terrapins", "Arizona State Sun Devils",
  "Vanderbilt Commodores", "Clemson Tigers", "Oregon Ducks", "Memphis Tigers",
  "BYU Cougars", "Louisville Cardinals", "North Carolina Tar Heels",
  "Ole Miss Rebels", "Missouri Tigers", "UCLA Bruins",
  "Saint Mary's Gaels", "Miami Hurricanes", "Marquette Golden Eagles",
  "Ohio State Buckeyes", "Georgia Bulldogs", "Villanova Wildcats",
  "TCU Horned Frogs", "Utah State Aggies", "Iowa Hawkeyes",
  "Saint Louis Billikens", "Baylor Bears", "Creighton Bluejays",
  "Oklahoma Sooners",
  "Texas A&M Aggies", "Santa Clara Broncos", "UCF Knights",
  "New Mexico Lobos",
  "VCU Rams", "South Florida Bulls", "Texas Longhorns",
  "NC State Wolfpack", "SMU Mustangs", "Drake Bulldogs",
  "Miami (OH) RedHawks", "Miami Ohio RedHawks",
  "McNeese Cowboys", "McNeese State Cowboys",
  "Northern Iowa Panthers",
  "Akron Zips", "High Point Panthers",
  "Liberty Flames", "UCSD Tritons", "UC San Diego Tritons",
  "Colorado State Rams",
  "Hofstra Pride", "Troy Trojans",
  "Hawaii Rainbow Warriors", "Hawai'i Rainbow Warriors", "Hawai'i Rainbow Warriors",
  "California Baptist Lancers", "Cal Baptist Lancers",
  "Grand Canyon Antelopes", "Lipscomb Bisons",
  "Yale Bulldogs",
  "North Dakota State Bison",
  "Kennesaw State Owls",
  "Wright State Raiders", "Wright St Raiders",
  "Penn Quakers",
  "Furman Paladins",
  "Tennessee State Tigers", "Tennessee St Tigers",
  "Queens Royals", "Queens University Royals",
  "Idaho Vandals",
  "Wofford Terriers",
  "Bryant Bulldogs",
  "Robert Morris Colonials",
  "Omaha Mavericks", "Nebraska-Omaha Mavericks",
  "Long Island Sharks", "Long Island University Sharks", "LIU Sharks",
  "Siena Saints",
  "Lehigh Mountain Hawks",
  "Howard Bison",
  "Prairie View A&M Panthers", "Prairie View Panthers",
  "UMBC Retrievers",
  "Norfolk State Spartans",
  "Alabama State Hornets",
  "Mount St. Mary's Mountaineers",
  "Montana Grizzlies",
];

// Normalize: strip special chars, lowercase
function normalize(s) {
  return s.toLowerCase()
    .replace(/[''ʻ']/g, '')
    .replace(/\./g, '')
    .replace(/[^a-z0-9 &()-]/g, '')
    .trim();
}

const TOURNEY_NORMALIZED = new Set(TOURNAMENT_TEAMS.map(normalize));

// Also build a set of just first words for fuzzy matching
const TOURNEY_FIRST_WORDS = new Set(TOURNAMENT_TEAMS.map(t => normalize(t).split(' ')[0]));

function isTournamentTeam(teamName) {
  if (!teamName) return false;
  const norm = normalize(teamName);

  // Exact normalized match
  if (TOURNEY_NORMALIZED.has(norm)) return true;

  // Check if first word + last word both appear in any tournament team
  const words = norm.split(' ');
  const first = words[0];
  const last = words[words.length - 1];

  for (const t of TOURNEY_NORMALIZED) {
    if (t.includes(first) && t.includes(last)) return true;
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

  if (month === 3 && day <= 19) return 'r64';
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

    // Log all teams for debugging
    const allTeams = new Set();
    rawGames.forEach(g => { allTeams.add(g.home_team); allTeams.add(g.away_team); });

    // Find unmatched teams
    const unmatched = [];
    allTeams.forEach(t => { if (!isTournamentTeam(t)) unmatched.push(t); });

    // Filter to tournament games
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
      unmatchedTeams: unmatched,
    });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
