import { createClient } from "@supabase/supabase-js";
import { lockTime } from "../../lib/fixtures";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { matchId, predictedResult, kickoff } = req.body || {};
  if (!matchId || !["home", "draw", "away"].includes(predictedResult) || !kickoff) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "no_token" });

  // Verify the token as this specific user (RLS then enforces they can
  // only write their own row -- never trust a user_id from the client).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "invalid_session" });

  // Server-side lock check -- never trust the client's clock/JS state.
  if (Date.now() >= lockTime(kickoff)) {
    return res.status(403).json({ error: "locked" });
  }

  const { error } = await supabase.from("predictions").upsert(
    { user_id: userData.user.id, match_id: matchId, predicted_result: predictedResult },
    { onConflict: "user_id,match_id" }
  );
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ ok: true });
}
