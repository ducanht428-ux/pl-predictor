import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getAllFixtures, actualResult } from "../../lib/fixtures";
import { botPredict } from "../../lib/botPredictor";

export default async function handler(req, res) {
  try {
    const [matches, predictionsRes, profilesRes] = await Promise.all([
      getAllFixtures(),
      supabaseAdmin.from("predictions").select("user_id, match_id, predicted_result"),
      supabaseAdmin.from("profiles").select("id, display_name"),
    ]);
    if (predictionsRes.error) throw new Error(predictionsRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const nameOf = {};
    (profilesRes.data || []).forEach((p) => (nameOf[p.id] = p.display_name));

    const finished = matches.filter((m) => m.status === "finished");
    const resultOf = {};
    finished.forEach((m) => (resultOf[m.id] = actualResult(m)));

    let botPoints = 0;
    finished.forEach((m) => {
      const bot = botPredict(m.home, m.away);
      botPoints += bot === resultOf[m.id] ? 3 : -1;
    });

    const totals = {};
    (predictionsRes.data || []).forEach((p) => {
      const res = resultOf[p.match_id];
      if (!res) return; // match not finished yet, doesn't count
      const gain = p.predicted_result === res ? 3 : -1;
      const name = nameOf[p.user_id] || "Player";
      totals[p.user_id] = totals[p.user_id] || { name, points: 0 };
      totals[p.user_id].points += gain;
    });

    const leaderboard = Object.values(totals).sort((a, b) => b.points - a.points);
    res.status(200).json({ leaderboard, botPoints });
  } catch (e) {
    res.status(500).json({ error: "leaderboard_failed", detail: e?.message || String(e) });
  }
}
