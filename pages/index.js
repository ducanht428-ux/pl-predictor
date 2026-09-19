import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

function fmtTime(iso) {
  return new Date(iso).toLocaleString("vi-VN", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function isLocked(kickoffIso) {
  return Date.now() >= new Date(kickoffIso).getTime() - 8 * 3600 * 1000;
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [tab, setTab] = useState("matches");
  const [matches, setMatches] = useState([]);
  const [myPicks, setMyPicks] = useState({}); // matchId -> predicted_result
  const [pickStats, setPickStats] = useState({});
  const [leaderboard, setLeaderboard] = useState({ leaderboard: [], botPoints: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  // ---- auth ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
      ensureProfile(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) router.replace("/login");
      else { setSession(s); ensureProfile(s.user); }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureProfile(user) {
    const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    if (data?.display_name) {
      setDisplayName(data.display_name);
    } else {
      const pending = (typeof window !== "undefined" && localStorage.getItem("pl_pending_name")) || user.email.split("@")[0];
      await supabase.from("profiles").insert({ id: user.id, display_name: pending });
      setDisplayName(pending);
    }
  }

  // ---- data loading ----
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fxRes, statsRes, lbRes] = await Promise.all([
        fetch("/api/fixtures").then((r) => r.json()),
        fetch("/api/pick-stats").then((r) => r.json()),
        fetch("/api/leaderboard").then((r) => r.json()),
      ]);
      setMatches(fxRes.matches || []);
      setPickStats(statsRes.stats || {});
      setLeaderboard(lbRes);

      if (session) {
        const { data } = await supabase
          .from("predictions")
          .select("match_id, predicted_result")
          .eq("user_id", session.user.id);
        const picks = {};
        (data || []).forEach((p) => (picks[p.match_id] = p.predicted_result));
        setMyPicks(picks);
      }
    } catch (e) {
      setNotice("Không tải được dữ liệu: " + String(e));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadAll();
  }, [session, loadAll]);

  async function submitPick(matchId, kickoff, pick) {
    setNotice("");
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) { router.replace("/login"); return; }

    setMyPicks((prev) => ({ ...prev, [matchId]: pick })); // optimistic
    const r = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId, predictedResult: pick, kickoff }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setNotice(body.error === "locked" ? "Trận này đã bị khóa (trong vòng 8h trước giờ bóng lăn)." : "Không lưu được dự đoán, thử lại nhé.");
      loadAll(); // revert optimistic update to real state
      return;
    }
    loadAll();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!session) return null;

  const finished = matches.filter((m) => m.status === "finished");
  const resultOf = {};
  finished.forEach((m) => {
    resultOf[m.id] = m.homeScore > m.awayScore ? "home" : m.homeScore < m.awayScore ? "away" : "draw";
  });

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1 className="title">⚽ PL Predictor</h1>
          <p className="subtitle">Xin chào, {displayName}</p>
        </div>
        <button className="pick-btn" onClick={logout}>Đăng xuất</button>
      </div>

      <div className="tabs">
        {[["matches", "Trận đấu"], ["bot", "Bot vs Bạn"], ["leaderboard", "Leaderboard"]].map(([k, label]) => (
          <button key={k} className={"tab-btn" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {notice && <div className="notice-box">{notice}</div>}
      {loading && <p className="subtitle">Đang tải...</p>}

      {tab === "matches" && (
        <div className="stack">
          {matches.map((m) => {
            const locked = isLocked(m.kickoff);
            const finishedMatch = m.status === "finished";
            const mine = myPicks[m.id];
            const showBars = locked || finishedMatch;
            const stats = pickStats[m.id] || { home: 0, draw: 0, away: 0, total: 0 };
            const pct = (side) => (stats.total ? Math.round((stats[side] / stats.total) * 100) : 0);

            return (
              <div className="card match-card" key={m.id}>
                <div className="match-top">
                  <span className="teams">{m.home} <span className="vs">vs</span> {m.away}</span>
                  <span className="kickoff">{fmtTime(m.kickoff)}</span>
                </div>
                <div className="pick-row">
                  {["home", "draw", "away"].map((side) => (
                    <button
                      key={side}
                      className={"pick-btn" + (mine === side ? " selected" : "")}
                      disabled={locked || finishedMatch}
                      onClick={() => submitPick(m.id, m.kickoff, side)}
                    >
                      {side === "home" ? m.home : side === "draw" ? "Hòa" : m.away}
                    </button>
                  ))}
                </div>
                {finishedMatch && (
                  <div className="result-line">
                    <b>{m.homeScore} - {m.awayScore}</b>{" "}
                    {mine ? (
                      <span className={mine === resultOf[m.id] ? "ok" : "bad"}>
                        {mine === resultOf[m.id] ? "Đúng +3" : "Sai -1"}
                      </span>
                    ) : (
                      <span className="dim">Bạn chưa dự đoán</span>
                    )}
                  </div>
                )}
                {!finishedMatch && locked && <div className="dim small">🔒 Đã khóa dự đoán</div>}
                {showBars && (
                  <div className="bars">
                    {["home", "draw", "away"].map((side) => (
                      <div key={side}>
                        <div className="bar-label"><span>{side === "home" ? m.home : side === "draw" ? "Hòa" : m.away}</span><span>{pct(side)}%</span></div>
                        <div className="bar-track"><div className="bar-fill" style={{ width: pct(side) + "%" }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "bot" && (
        <div className="stack">
          <div className="card">
            <div className="small">🤖 Điểm của Bot</div>
            <div className="bot-score">{leaderboard.botPoints} điểm</div>
          </div>
          {leaderboard.leaderboard.map((r, i) => (
            <div className="card row-between" key={i}>
              <span>{r.name}</span>
              <span className={r.points > leaderboard.botPoints ? "ok" : r.points === leaderboard.botPoints ? "dim" : "bad"}>
                {r.points} điểm {r.points > leaderboard.botPoints ? "🔥 thắng Bot" : r.points === leaderboard.botPoints ? "= hòa Bot" : "thua Bot"}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="stack">
          {leaderboard.leaderboard.length === 0 && <p className="dim">Chưa có điểm nào.</p>}
          {leaderboard.leaderboard.map((r, i) => (
            <div className="card row-between" key={i}>
              <span><span className="dim">#{i + 1}</span> {r.name}</span>
              <span className="points">{r.points} điểm</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
