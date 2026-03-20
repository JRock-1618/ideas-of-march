// Shortens "Duke Blue Devils" → "Duke", "Michigan State Spartans" → "Michigan St"
const SHORT_NAMES = {
  "Duke Blue Devils": "Duke", "Michigan Wolverines": "Michigan", "Arizona Wildcats": "Arizona",
  "Florida Gators": "Florida", "Houston Cougars": "Houston", "Purdue Boilermakers": "Purdue",
  "Iowa State Cyclones": "Iowa State", "Connecticut Huskies": "UConn",
  "St. John's Red Storm": "St. John's", "Tennessee Volunteers": "Tennessee",
  "Alabama Crimson Tide": "Alabama", "Michigan State Spartans": "Michigan St",
  "Illinois Fighting Illini": "Illinois", "Wisconsin Badgers": "Wisconsin",
  "Gonzaga Bulldogs": "Gonzaga", "Virginia Cavaliers": "Virginia",
  "Kentucky Wildcats": "Kentucky", "Texas Tech Red Raiders": "Texas Tech",
  "Arkansas Razorbacks": "Arkansas", "Nebraska Cornhuskers": "Nebraska",
  "Kansas Jayhawks": "Kansas", "Maryland Terrapins": "Maryland",
  "Vanderbilt Commodores": "Vanderbilt", "Clemson Tigers": "Clemson",
  "Oregon Ducks": "Oregon", "Memphis Tigers": "Memphis",
  "BYU Cougars": "BYU", "Louisville Cardinals": "Louisville",
  "North Carolina Tar Heels": "UNC", "Ole Miss Rebels": "Ole Miss",
  "Missouri Tigers": "Mizzou", "UCLA Bruins": "UCLA",
  "Saint Mary's Gaels": "Saint Mary's", "Miami Hurricanes": "Miami (FL)",
  "Marquette Golden Eagles": "Marquette", "Ohio State Buckeyes": "Ohio State",
  "Georgia Bulldogs": "Georgia", "Villanova Wildcats": "Villanova",
  "TCU Horned Frogs": "TCU", "Utah State Aggies": "Utah State",
  "Iowa Hawkeyes": "Iowa", "Saint Louis Billikens": "Saint Louis",
  "Baylor Bears": "Baylor", "Creighton Bluejays": "Creighton",
  "Oklahoma Sooners": "Oklahoma", "Texas A&M Aggies": "Texas A&M",
  "Santa Clara Broncos": "Santa Clara", "UCF Knights": "UCF",
  "New Mexico Lobos": "New Mexico", "VCU Rams": "VCU",
  "South Florida Bulls": "South Florida", "Texas Longhorns": "Texas",
  "NC State Wolfpack": "NC State", "SMU Mustangs": "SMU",
  "Drake Bulldogs": "Drake", "Miami (OH) RedHawks": "Miami (OH)",
  "McNeese Cowboys": "McNeese", "Northern Iowa Panthers": "Northern Iowa",
  "Akron Zips": "Akron", "High Point Panthers": "High Point",
  "Liberty Flames": "Liberty", "UCSD Tritons": "UCSD",
  "Colorado State Rams": "Colorado St", "Hofstra Pride": "Hofstra",
  "Troy Trojans": "Troy", "Hawaii Rainbow Warriors": "Hawaii", "Hawai'i Rainbow Warriors": "Hawaii",
  "California Baptist Lancers": "Cal Baptist", "Grand Canyon Antelopes": "Grand Canyon",
  "Lipscomb Bisons": "Lipscomb", "Yale Bulldogs": "Yale",
  "North Dakota State Bison": "NDSU", "Kennesaw State Owls": "Kennesaw St",
  "Wright State Raiders": "Wright State", "Penn Quakers": "Penn",
  "Furman Paladins": "Furman", "Tennessee State Tigers": "Tennessee St",
  "Queens Royals": "Queens", "Idaho Vandals": "Idaho",
  "Wofford Terriers": "Wofford", "Bryant Bulldogs": "Bryant",
  "Robert Morris Colonials": "Robert Morris", "Omaha Mavericks": "Omaha",
  "Long Island Sharks": "LIU", "Long Island University Sharks": "LIU", "LIU Sharks": "LIU", "Siena Saints": "Siena",
  "Lehigh Mountain Hawks": "Lehigh", "Howard Bison": "Howard",
  "Prairie View A&M Panthers": "Prairie View", "UMBC Retrievers": "UMBC",
  "Norfolk State Spartans": "Norfolk St", "Alabama State Hornets": "Alabama St",
  "Mount St. Mary's Mountaineers": "Mt St Mary's", "Montana Grizzlies": "Montana",
};

export function shortName(fullName) {
  if (!fullName) return "";
  if (SHORT_NAMES[fullName]) return SHORT_NAMES[fullName];
  // Fallback: drop the last word (mascot)
  const parts = fullName.split(" ");
  return parts.length > 1 ? parts.slice(0, -1).join(" ") : fullName;
}

// ESPN team ID mapping for logos (will work when deployed, not in artifact)
export const ESPN_IDS = {
  "Duke Blue Devils": 150, "Michigan Wolverines": 130, "Arizona Wildcats": 12,
  "Florida Gators": 57, "Houston Cougars": 248, "Purdue Boilermakers": 2509,
  "Iowa State Cyclones": 66, "Connecticut Huskies": 41,
  "St. John's Red Storm": 2599, "Tennessee Volunteers": 2633,
  "Alabama Crimson Tide": 333, "Michigan State Spartans": 127,
  "Illinois Fighting Illini": 356, "Wisconsin Badgers": 275,
  "Gonzaga Bulldogs": 2250, "Virginia Cavaliers": 258,
  "Kentucky Wildcats": 96, "Texas Tech Red Raiders": 2641,
  "Arkansas Razorbacks": 8, "Nebraska Cornhuskers": 158,
  "Kansas Jayhawks": 2305, "Maryland Terrapins": 120,
  "Vanderbilt Commodores": 238, "Clemson Tigers": 228,
  "Oregon Ducks": 2483, "Memphis Tigers": 235,
  "BYU Cougars": 252, "Louisville Cardinals": 97,
  "North Carolina Tar Heels": 153, "Ole Miss Rebels": 145,
  "Missouri Tigers": 142, "UCLA Bruins": 26,
  "Saint Mary's Gaels": 2608, "Marquette Golden Eagles": 269,
  "Ohio State Buckeyes": 194, "Baylor Bears": 239,
  "Creighton Bluejays": 156,
};

export function teamLogoUrl(fullName) {
  const id = ESPN_IDS[fullName];
  return id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : null;
}

// Emoji fallback for artifact/prototype use
const TEAM_EMOJI = {
  "Duke Blue Devils":"😈","Michigan Wolverines":"🦡","Arizona Wildcats":"🐱",
  "Florida Gators":"🐊","Houston Cougars":"🐆","Purdue Boilermakers":"🚂",
  "Iowa State Cyclones":"🌪️","Connecticut Huskies":"🐺",
  "St. John's Red Storm":"🌀","Tennessee Volunteers":"🍊",
  "Alabama Crimson Tide":"🐘","Michigan State Spartans":"⚔️",
  "Illinois Fighting Illini":"🔶","Wisconsin Badgers":"🦡",
  "Gonzaga Bulldogs":"🐶","Virginia Cavaliers":"⚔️",
  "Kentucky Wildcats":"🐱","Texas Tech Red Raiders":"🔴",
  "Arkansas Razorbacks":"🐗","Kansas Jayhawks":"🐦",
  "BYU Cougars":"🏔️","Louisville Cardinals":"🐦",
  "UCLA Bruins":"🐻","Baylor Bears":"🐻",
  "Oregon Ducks":"🦆","Marquette Golden Eagles":"🦅",
  "Clemson Tigers":"🐯","Ohio State Buckeyes":"🌰",
  "Ole Miss Rebels":"🐻","North Carolina Tar Heels":"🐏",
  "Creighton Bluejays":"🐦‍⬛","Maryland Terrapins":"🐢",
  "Auburn Tigers":"🐯","VCU Rams":"🐏",
};

export function teamEmoji(fullName) {
  if (!fullName) return "🏀";
  return TEAM_EMOJI[fullName] || "🏀";
}
