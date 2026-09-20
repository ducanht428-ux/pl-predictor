import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { matchId, playerName } = req.body || {};
  const name = String(playerName || "").trim().slice(0, 40);
  if (!matchId || !name) return res.status(400).json({ error: "invalid_body" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "no_token" });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "invalid_session" });

  const { error } = await supabase.from("motm_votes").upsert(
    { user_id: userData.user.id, match_id: matchId, player_name: name },
    { onConflict: "user_id,match_id" }
  );
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ ok: true });
}
