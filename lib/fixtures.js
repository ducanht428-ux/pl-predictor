// SERVER-SIDE ONLY (uses the football-data.org API key).
// Simple in-memory cache, keyed per competition, so a single page
// load doesn't call football-data.org twice for the same league and
// burn through the free-tier rate limit.
export const COMPETITIONS = {
  PL: "Premier League",
  PD: "La Liga",
  FL1: "Ligue 1",
  CL: "UEFA Champions League",
};

let _cache = {}; // code -> { data, at }
const CACHE_MS = 90 * 1000; // 90s

export async function getFixtures(code = "PL") {
  const c = _cache[code];
  if (c && Date.now() - c.at < CACHE_MS) {
    return c.data;
  }
  const r = await fetch(
    `https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED,FINISHED`,
    { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY } }
  );
  if (!r.ok) {
    if (c) return c.data; // serve stale data instead of failing
    throw new Error(`football-data.org request failed for ${code}: ${r.status}`);
  }
  const data = await r.json();
  const matches = (data.matches || []).map((m) => ({
    id: String(m.id),
    competition: code,
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    kickoff: m.utcDate,
    status: m.status === "FINISHED" ? "finished" : "upcoming",
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
  }));
  _cache[code] = { data: matches, at: Date.now() };
  return matches;
}

// Fetches every supported competition and merges them -- used by
// leaderboard/pick-stats so scoring works no matter which league a
// prediction was made on.
export async function getAllFixtures() {
  const codes = Object.keys(COMPETITIONS);
  const results = await Promise.all(
    codes.map((code) => getFixtures(code).catch(() => []))
  );
  return results.flat();
}

export function actualResult(m) {
  if (m.status !== "finished" || m.homeScore === null) return null;
  if (m.homeScore > m.awayScore) return "home";
  if (m.homeScore < m.awayScore) return "away";
  return "draw";
}

export function lockTime(kickoffIso) {
  return new Date(kickoffIso).getTime() - 8 * 3600 * 1000;
}
