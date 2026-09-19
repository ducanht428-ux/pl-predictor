// SERVER-SIDE ONLY (uses the football-data.org API key).
export async function getFixtures() {
  const r = await fetch(
    "https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED,FINISHED",
    { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY } }
  );
  if (!r.ok) {
    throw new Error("football-data.org request failed: " + r.status);
  }
  const data = await r.json();
  return (data.matches || []).map((m) => ({
    id: String(m.id),
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    kickoff: m.utcDate,
    status: m.status === "FINISHED" ? "finished" : "upcoming",
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
  }));
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
