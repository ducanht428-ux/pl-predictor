import { getFixtures } from "../../lib/fixtures";

export default async function handler(req, res) {
  try {
    const matches = await getFixtures();
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    res.status(200).json({ matches });
  } catch (e) {
    res.status(500).json({ error: "fixtures_fetch_failed", detail: String(e) });
  }
}
