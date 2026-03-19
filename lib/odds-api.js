const BASE_URL = 'https://api.the-odds-api.com/v4';
const SPORT = 'basketball_ncaab';
const API_KEY = process.env.ODDS_API_KEY;

export async function fetchGames() {
  const res = await fetch(
    `${BASE_URL}/sports/${SPORT}/odds/?apiKey=${API_KEY}&regions=us&markets=spreads,totals,h2h&oddsFormat=american`,
    { next: { revalidate: 900 } } // cache 15 min
  );
  if (!res.ok) throw new Error(`Odds API error: ${res.status}`);
  return res.json();
}

export async function fetchScores() {
  const res = await fetch(
    `${BASE_URL}/sports/${SPORT}/scores/?apiKey=${API_KEY}&daysFrom=3`,
    { next: { revalidate: 300 } } // cache 5 min
  );
  if (!res.ok) throw new Error(`Odds API error: ${res.status}`);
  return res.json();
}

// Transform raw Odds API game into our schema
export function transformGame(raw) {
  const home = raw.home_team;
  const away = raw.away_team;

  // Find best available bookmaker (prioritize FanDuel, DraftKings, then first available)
  const preferredBooks = ['fanduel', 'draftkings', 'betmgm', 'pointsbetus'];
  const bookmaker = preferredBooks.reduce((found, key) => {
    return found || raw.bookmakers?.find(b => b.key === key);
  }, null) || raw.bookmakers?.[0];

  if (!bookmaker) {
    return {
      external_id: raw.id,
      home_team: home,
      away_team: away,
      commence_time: raw.commence_time,
      spread: null, spread_odds: null,
      total: null, over_odds: null, under_odds: null,
      home_ml: null, away_ml: null,
    };
  }

  const spreads = bookmaker.markets?.find(m => m.key === 'spreads');
  const totals = bookmaker.markets?.find(m => m.key === 'totals');
  const h2h = bookmaker.markets?.find(m => m.key === 'h2h');

  const homeSpread = spreads?.outcomes?.find(o => o.name === home);
  const awaySpread = spreads?.outcomes?.find(o => o.name === away);
  const over = totals?.outcomes?.find(o => o.name === 'Over');
  const under = totals?.outcomes?.find(o => o.name === 'Under');
  const homeML = h2h?.outcomes?.find(o => o.name === home);
  const awayML = h2h?.outcomes?.find(o => o.name === away);

  // Determine favorite (lower spread = favorite)
  const homeFav = homeSpread && homeSpread.point < 0;

  return {
    external_id: raw.id,
    home_team: home,
    away_team: away,
    commence_time: raw.commence_time,
    favorite: homeFav ? home : away,
    underdog: homeFav ? away : home,
    spread: homeFav ? String(homeSpread?.point) : String(awaySpread?.point),
    spread_odds: String(homeSpread?.price || -110),
    total: String(over?.point || ''),
    over_odds: String(over?.price || -110),
    under_odds: String(under?.price || -110),
    fav_ml: String(homeFav ? homeML?.price : awayML?.price),
    dog_ml: String(homeFav ? awayML?.price : homeML?.price),
  };
}

// ESPN team logo mapping
const ESPN_IDS = {
  'Louisville Cardinals': 97, 'Creighton Bluejays': 156, 'Purdue Boilermakers': 2509,
  'Auburn Tigers': 2, 'Duke Blue Devils': 150, 'Alabama Crimson Tide': 333,
  'BYU Cougars': 252, 'VCU Rams': 2670, 'Gonzaga Bulldogs': 2250,
  'Kansas Jayhawks': 2305, 'Michigan Wolverines': 130, 'Iowa State Cyclones': 66,
  'Arizona Wildcats': 12, 'Baylor Bears': 239, 'Tennessee Volunteers': 2633,
  'UCLA Bruins': 26, 'UConn Huskies': 41, 'Michigan State Spartans': 127,
  'Florida Gators': 57, 'Maryland Terrapins': 120, 'Kentucky Wildcats': 96,
  'Texas Tech Red Raiders': 2641, 'St. John\'s Red Storm': 2599, 'Oregon Ducks': 2483,
  'Marquette Golden Eagles': 269, 'Ole Miss Rebels': 145, 'North Carolina Tar Heels': 153,
  'Clemson Tigers': 228, 'Wisconsin Badgers': 275, 'Houston Cougars': 248,
  'Illinois Fighting Illini': 356, 'Arkansas Razorbacks': 8,
};

export function getTeamLogoUrl(teamName) {
  // Try exact match first, then partial match
  const id = ESPN_IDS[teamName] || Object.entries(ESPN_IDS).find(([k]) =>
    teamName.includes(k.split(' ')[0]) || k.includes(teamName.split(' ')[0])
  )?.[1];
  return id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : null;
}
