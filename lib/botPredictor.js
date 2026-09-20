// Very simple illustrative "strength" table (lower = stronger).
// Swap this for a real model (xG, recent form, Elo, etc.) later --
// every API route calls this one function, so upgrading it upgrades
// the bot everywhere at once.
const STRENGTH = {
  // Premier League
  "Manchester City FC": 1, "Arsenal FC": 2, "Liverpool FC": 3,
  "Chelsea FC": 5, "Newcastle United FC": 6, "Tottenham Hotspur FC": 7,
  "Manchester United FC": 8, "Aston Villa FC": 9, "Brighton & Hove Albion FC": 10,
  "West Ham United FC": 12, "Nottingham Forest FC": 11, "Crystal Palace FC": 13,
  "Everton FC": 14, "Wolverhampton Wanderers FC": 15, "Fulham FC": 13,
  "Brentford FC": 12, "AFC Bournemouth": 11, "Leeds United FC": 17,
  "Burnley FC": 18, "Sunderland AFC": 16,

  // La Liga
  "Real Madrid CF": 1, "FC Barcelona": 2, "Atlético de Madrid": 4,
  "Real Sociedad de Fútbol": 8, "Real Betis Balompié": 9, "Villarreal CF": 7,
  "Athletic Club": 6, "Sevilla FC": 10, "Valencia CF": 11,
  "CA Osasuna": 13, "RC Celta de Vigo": 12, "RCD Mallorca": 14,
  "Girona FC": 10, "Deportivo Alavés": 15, "UD Las Palmas": 16,
  "RCD Espanyol de Barcelona": 14, "Getafe CF": 13, "CD Leganés": 17,
  "Rayo Vallecano de Madrid": 12, "Real Valladolid CF": 18,

  // Ligue 1
  "Paris Saint-Germain FC": 1, "AS Monaco FC": 5, "Olympique de Marseille": 4,
  "LOSC Lille": 6, "Olympique Lyonnais": 7, "OGC Nice": 9,
  "RC Lens": 8, "Stade Rennais FC 1901": 10, "RC Strasbourg Alsace": 12,
  "Stade Brestois 29": 13, "Toulouse FC": 14, "Montpellier HSC": 15,
  "FC Nantes": 13, "Le Havre AC": 16, "AJ Auxerre": 15,
  "Angers SCO": 16, "AS Saint-Étienne": 17, "Stade de Reims": 14, "Paris FC": 12,

  // Extra Champions League clubs (not already listed above)
  "FC Bayern München": 1, "Bayer 04 Leverkusen": 4, "Borussia Dortmund": 5,
  "RB Leipzig": 6, "VfB Stuttgart": 9,
  "FC Internazionale Milano": 3, "Juventus FC": 5, "AC Milan": 6,
  "SSC Napoli": 4, "AS Roma": 8, "Atalanta BC": 7,
  "Sporting Clube de Portugal": 8, "SL Benfica": 7, "FC Porto": 9,
  "PSV": 8, "AFC Ajax": 9, "Club Brugge KV": 10,
};

function strengthOf(teamName) {
  return STRENGTH[teamName] ?? 10; // unknown team = mid-table guess
}

export function botPredict(homeTeam, awayTeam) {
  const diff = strengthOf(awayTeam) - strengthOf(homeTeam);
  const adjusted = diff + 2; // small home advantage
  if (adjusted > 2) return "home";
  if (adjusted < -2) return "away";
  return "draw";
}
