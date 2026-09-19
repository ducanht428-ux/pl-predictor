import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select("match_id, predicted_result");
  if (error) return res.status(500).json({ error: error.message });

  const stats = {};
  (data || []).forEach((p) => {
    stats[p.match_id] = stats[p.match_id] || { home: 0, draw: 0, away: 0, total: 0 };
    stats[p.match_id][p.predicted_result] += 1;
    stats[p.match_id].total += 1;
  });
  res.status(200).json({ stats });
}
