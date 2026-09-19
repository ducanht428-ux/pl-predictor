// Very simple illustrative "strength" table (lower = stronger).
// Swap this for a real model (xG, recent form, Elo, etc.) later --
// every API route calls this one function, so upgrading it upgrades
// the bot everywhere at once.
const STRENGTH = {
  "Manchester City FC": 1, "Arsenal FC": 2, "Liverpool FC": 3,
  "Chelsea FC": 5, "Newcastle United FC": 6, "Tottenham Hotspur FC": 7,
  "Manchester United FC": 8, "Aston Villa FC": 9, "Brighton & Hove Albion FC": 10,
  "West Ham United FC": 12, "Nottingham Forest FC": 11, "Crystal Palace FC": 13,
  "Everton FC": 14, "Wolverhampton Wanderers FC": 15, "Fulham FC": 13,
  "Brentford FC": 12, "AFC Bournemouth": 11, "Leeds United FC": 17,
  "Burnley FC": 18, "Sunderland AFC": 16,
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
