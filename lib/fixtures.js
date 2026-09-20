// SERVER-SIDE ONLY (uses the football-data.org API key).
// Cache is stored in Supabase (not in-memory) because Vercel's
// serverless functions can "cold start" at any time, which would
// wipe an in-memory cache and cause repeated football-data.org calls
// that blow through the free-tier rate limit.
import { supabaseAdmin } from "./supabaseAdmin";

export const COMPETITIONS = {
  PL: "Premier League",
  PD: "La Liga",
  FL1: "Ligue 1",
  CL: "UEFA Champions League",
};

const CACHE_MS = 5 * 60 * 1000; // 5 minutes

export async function getFixtures(code = "PL") {
  const { data: cached } = await supabaseAdmin
    .from("fixtures_cache")
    .select("data, updated_at")
    .eq("competition", code)
    .maybeSingle();

  const fresh = cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_MS;
  if (fresh) return cached.data;

  try {
    const r = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED,FINISHED`,
      { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY } }
    );
    if (!r.ok) throw new Error(`football-data.org request failed for ${code}: ${r.status}`);
    const json = await r.json();
    const matches = (json.matches || []).map((m) => ({
      id: String(m.id),
      competition: code,
      home: m.homeTeam.name,
      away: m.awayTeam.name,
      kickoff: m.utcDate,
      status: m.status === "FINISHED" ? "finished" : "upcoming",
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
    }));
    await supabaseAdmin
      .from("fixtures_cache")
      .upsert({ competition: code, data: matches, updated_at: new Date().toISOString() });
    return matches;
  } catch (e) {
    if (cached) return cached.data; // serve stale data instead of failing
    throw e;
  }
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
