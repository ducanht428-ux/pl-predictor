// SERVER-SIDE ONLY (uses the football-data.org API key).
// Simple in-memory cache so a single page load doesn't call
// football-data.org twice (once for /api/fixtures, once for
// /api/leaderboard) and burn through the free-tier rate limit.
let _cache = { data: null, at: 0 };
const CACHE_MS = 90 * 1000; // 90s

export async function getFixtures() {
  if (_cache.data && Date.now() - _cache.at < CACHE_MS) {
    return _cache.data;
  }
  const r = await fetch(
    "https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED,FINISHED",
    { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY } }
  );
  if (!r.ok) {
    if (_cache.data) return _cache.data; // serve stale data instead of failing
    throw new Error("football-data.org request failed: " + r.status);
  }
  const data = await r.json();
  const matches = (data.matches || []).map((m) => ({
    id: String(m.id),
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    kickoff: m.utcDate,
    status: m.status === "FINISHED" ? "finished" : "upcoming",
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
  }));
  _cache = { data: matches, at: Date.now() };
  return matches;
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
