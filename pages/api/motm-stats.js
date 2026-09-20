import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const { data, error } = await supabaseAdmin.from("motm_votes").select("match_id, player_name");
  if (error) return res.status(500).json({ error: error.message });

  const stats = {};
  (data || []).forEach((v) => {
    const key = v.player_name.trim();
    stats[v.match_id] = stats[v.match_id] || {};
    stats[v.match_id][key] = (stats[v.match_id][key] || 0) + 1;
  });
  res.status(200).json({ stats });
}
