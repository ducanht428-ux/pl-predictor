import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getFixtures, actualResult } from "../../lib/fixtures";
import { botPredict } from "../../lib/botPredictor";

export default async function handler(req, res) {
  try {
    const [matches, { data: predictions, error }] = await Promise.all([
      getFixtures(),
      supabaseAdmin
        .from("predictions")
        .select("user_id, match_id, predicted_result, profiles(display_name)"),
    ]);
    if (error) throw error;

    const finished = matches.filter((m) => m.status === "finished");
    const resultOf = {};
    finished.forEach((m) => (resultOf[m.id] = actualResult(m)));

    let botPoints = 0;
    finished.forEach((m) => {
      const bot = botPredict(m.home, m.away);
      botPoints += bot === resultOf[m.id] ? 3 : -1;
    });

    const totals = {};
    (predictions || []).forEach((p) => {
      const res = resultOf[p.match_id];
      if (!res) return; // match not finished yet, doesn't count
      const gain = p.predicted_result === res ? 3 : -1;
      const name = p.profiles?.display_name || "Player";
      totals[p.user_id] = totals[p.user_id] || { name, points: 0 };
      totals[p.user_id].points += gain;
    });

    const leaderboard = Object.values(totals).sort((a, b) => b.points - a.points);
    res.status(200).json({ leaderboard, botPoints });
  } catch (e) {
    res.status(500).json({ error: "leaderboard_failed", detail: String(e) });
  }
}
