import { getFixtures, COMPETITIONS } from "../../lib/fixtures";

export default async function handler(req, res) {
  const code = String(req.query.competition || "PL").toUpperCase();
  if (!COMPETITIONS[code]) {
    return res.status(400).json({ error: "invalid_competition", competitions: COMPETITIONS });
  }
  try {
    const matches = await getFixtures(code);
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    res.status(200).json({ matches, competitions: COMPETITIONS });
  } catch (e) {
    res.status(500).json({ error: "fixtures_fetch_failed", detail: e?.message || String(e) });
  }
}
