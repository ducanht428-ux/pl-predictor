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

const PLAYER_AVATARS = [
  "https://images.fotmob.com/image_resources/playerimages/737066.png", // Haaland
  "https://images.fotmob.com/image_resources/playerimages/292462.png", // Salah
  "https://images.fotmob.com/image_resources/playerimages/932260.png", // Saka
  "https://images.fotmob.com/image_resources/playerimages/688224.png", // Rashford
  "https://images.fotmob.com/image_resources/playerimages/1070732.png", // Cole Palmer
  "https://images.fotmob.com/image_resources/playerimages/210252.png", // De Bruyne
  "https://images.fotmob.com/image_resources/playerimages/183188.png", // Son Heung-Min
];

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [tab, setTab] = useState("matches");
  const [competition, setCompetition] = useState("PL");
  const COMPETITIONS = { PL: "Premier League", PD: "La Liga", FL1: "Ligue 1", CL: "Champions League" };
  const [matches, setMatches] = useState([]);
  const [myPicks, setMyPicks] = useState({});
  const [scoreInputs, setScoreInputs] = useState({});
  const [pickStats, setPickStats] = useState({});
  const [motmStats, setMotmStats] = useState({});
  const [myMotm, setMyMotm] = useState({});
  const [motmDrafts, setMotmDrafts] = useState({});
  const [leaderboard, setLeaderboard] = useState({ leaderboard: [], botPoints: 0 });
  const [realLeaderboard, setRealLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

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

  const fetchSupabaseLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, total_points")
        .order("total_points", { ascending: false })
        .limit(50);

      if (!error && data) {
        setRealLeaderboard(data);
      }
    } catch (err) {
      console.error("Lỗi lấy dữ liệu bảng xếp hạng:", err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fxRes, statsRes, lbRes, motmRes] = await Promise.all([
        fetch("/api/fixtures?competition=" + competition).then((r) => r.json()),
        fetch("/api/pick-stats").then((r) => r.json()),
        fetch("/api/leaderboard").then((r) => r.json()),
        fetch("/api/motm-stats").then((r) => r.json()),
      ]);
      setMatches(fxRes.matches || []);
      setPickStats(statsRes.stats || {});
      setMotmStats(motmRes.stats || {});
      setLeaderboard({ leaderboard: lbRes.leaderboard || [], botPoints: lbRes.botPoints || 0 });
      await fetchSupabaseLeaderboard();

      if (session) {
        const { data } = await supabase
          .from("predictions")
          .select("match_id, predicted_result, predicted_home, predicted_away")
          .eq("user_id", session.user.id);
        const picks = {};
        (data || []).forEach((p) => {
          picks[p.match_id] = { result: p.predicted_result, home: p.predicted_home, away: p.predicted_away };
        });
        setMyPicks(picks);

        const { data: motmData } = await supabase
          .from("motm_votes")
          .select("match_id, player_name")
          .eq("user_id", session.user.id);
        const mine = {};
        (motmData || []).forEach((v) => (mine[v.match_id] = v.player_name));
        setMyMotm(mine);
      }
    } catch (e) {
      setNotice("Không tải được dữ liệu: " + String(e));
    }
    setLoading(false);
  }, [session, competition, fetchSupabaseLeaderboard]);

  useEffect(() => {
    if (session) loadAll();
  }, [session, competition, loadAll]);

  async function submitPick(matchId, kickoff) {
    setNotice("");
    const draft = scoreInputs[matchId];
    if (!draft || draft.home === "" || draft.away === "" || draft.home == null || draft.away == null) {
      setNotice("Nhập đủ tỉ số 2 đội trước khi lưu nhé.");
      return;
    }
    const home = Number(draft.home);
    const away = Number(draft.away);
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) { router.replace("/login"); return; }

    const result = home > away ? "home" : home < away ? "away" : "draw";
    setMyPicks((prev) => ({ ...prev, [matchId]: { result, home, away } }));
    const r = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId, predictedHome: home, predictedAway: away, kickoff }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setNotice(body.error === "locked" ? "Trận này đã bị khóa." : "Không lưu được dự đoán.");
      loadAll();
      return;
    }
    loadAll();
  }

  async function submitMotm(matchId) {
    const name = (motmDrafts[matchId] ?? myMotm[matchId] ?? "").trim();
    if (!name) return;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) { router.replace("/login"); return; }

    setMyMotm((prev) => ({ ...prev, [matchId]: name }));
    await fetch("/api/motm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId, playerName: name }),
    });
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

  const displayLeaderboard = leaderboard.leaderboard.length > 0 
    ? leaderboard.leaderboard 
    : realLeaderboard.map((item) => ({ name: item.display_name || "Người chơi", points: item.total_points || 0 }));

  return (
    <div className="wrap">
      {/* --- CSS ANIMATION NÂNG CAO --- */}
      <style jsx global>{`
        @keyframes floatUpDown {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes neonGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(168, 85, 247, 0.3), inset 0 0 15px rgba(168, 85, 247, 0.1); }
          50% { box-shadow: 0 0 25px rgba(168, 85, 247, 0.7), inset 0 0 25px rgba(168, 85, 247, 0.3); }
        }
        @keyframes shimmerEffect {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .wrap {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .player-float {
          animation: floatUpDown 3.5s ease-in-out infinite;
        }
        .player-float:hover {
          transform: scale(1.15) rotate(5deg) !important;
          filter: drop-shadow(0 0 12px #a855f7);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .pro-card {
          position: relative;
          background: linear-gradient(145deg, #1e1938 0%, #16122b 100%);
          border: 1px solid rgba(168, 85, 247, 0.2);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pro-card:hover {
          transform: translateY(-5px);
          border-color: rgba(168, 85, 247, 0.8);
          animation: neonGlow 2.5s infinite;
        }
        .shimmer-btn {
          background: linear-gradient(90deg, #9333ea 0%, #c084fc 50%, #9333ea 100%);
          background-size: 200% auto;
          transition: 0.5s;
        }
        .shimmer-btn:hover {
          background-position: right center;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
        }
        .avatar-ring {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 2px solid #c084fc;
          background: #28214a;
          object-fit: cover;
          cursor: pointer;
          transition: all 0.3s ease;
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <div>
          <h1 className="title" style={{ letterSpacing: "1px" }}>⚽ PL Predictor</h1>
          <p className="subtitle">Xin chào, <span style={{ color: "#c084fc", fontWeight: "bold" }}>{displayName}</span></p>
        </div>
        <button className="pick-btn shimmer-btn" onClick={logout}>Đăng xuất</button>
      </div>

      {/* Banner Cầu Thủ Hoạt Họa Chất Lượng Cao */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", margin: "18px 0", flexWrap: "wrap" }}>
        {PLAYER_AVATARS.map((url, idx) => (
          <img 
            key={idx} 
            src={url} 
            alt="Star Player" 
            className="avatar-ring player-float" 
            style={{ animationDelay: `${idx * 0.4}s` }}
          />
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[["matches", "Trận đấu"], ["bot", "Bot vs Bạn"], ["leaderboard", "Leaderboard"]].map(([k, label]) => (
          <button key={k} className={"tab-btn" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "matches" && (
        <div className="tabs">
          {Object.entries(COMPETITIONS).map(([code, label]) => (
            <button
              key={code}
              className={"tab-btn" + (competition === code ? " active" : "")}
              onClick={() => setCompetition(code)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {notice && <div className="notice-box">{notice}</div>}
      {loading && <p className="subtitle">Đang tải dữ liệu động...</p>}

      {/* Matches Tab */}
      {tab === "matches" && (
        <div className="stack">
          {matches.map((m, index) => {
            const locked = isLocked(m.kickoff);
            const finishedMatch = m.status === "finished";
            const mine = myPicks[m.id];
            const showBars = locked || finishedMatch;
            const stats = pickStats[m.id] || { home: 0, draw: 0, away: 0, total: 0 };
            const pct = (side) => (stats.total ? Math.round((stats[side] / stats.total) * 100) : 0);
            const editable = !locked && !finishedMatch;
            const draft = scoreInputs[m.id] ?? { home: mine?.home ?? "", away: mine?.away ?? "" };
            const avatarUrl = PLAYER_AVATARS[index % PLAYER_AVATARS.length];

            return (
              <div className="card match-card pro-card" key={m.id}>
                <div className="match-top" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img src={avatarUrl} alt="Player Icon" className="avatar-ring player-float" style={{ width: "38px", height: "38px" }} />
                  <div style={{ flex: 1 }}>
                    <span className="teams">{m.home} <span className="vs">vs</span> {m.away}</span>
                    <div className="kickoff">{fmtTime(m.kickoff)}</div>
                  </div>
                </div>

                {editable ? (
                  <div className="score-row">
                    <input
                      type="number" min="0" max="30" className="score-input"
                      value={draft.home}
                      onChange={(e) => setScoreInputs((prev) => ({ ...prev, [m.id]: { ...draft, home: e.target.value } }))}
                    />
                    <span className="dim">-</span>
                    <input
                      type="number" min="0" max="30" className="score-input"
                      value={draft.away}
                      onChange={(e) => setScoreInputs((prev) => ({ ...prev, [m.id]: { ...draft, away: e.target.value } }))}
                    />
                    <button className="pick-btn selected shimmer-btn score-save-btn" onClick={() => submitPick(m.id, m.kickoff)}>
                      {mine ? "Cập nhật" : "Lưu dự đoán"}
                    </button>
                  </div>
                ) : (
                  <div className="result-line">
                    {mine ? (
                      <>Bạn dự đoán: <b>{mine.home} - {mine.away}</b></>
                    ) : (
                      <span className="dim">Bạn chưa dự đoán</span>
                    )}
                  </div>
                )}

                {finishedMatch && (
                  <div className="result-line">
                    <b>{m.homeScore} - {m.awayScore}</b>{" "}
                    {mine ? (
                      <span className={mine.result === resultOf[m.id] ? "ok" : "bad"}>
                        {mine.result === resultOf[m.id] ? "Đúng +3" : "Sai -1"}
                      </span>
                    ) : null}
                  </div>
                )}

                {finishedMatch && (
                  <div className="motm-block">
                    <div className="small">⭐ Cầu thủ xuất sắc nhất trận</div>
                    <div className="motm-row">
                      <input
                        className="motm-input"
                        placeholder="Tên cầu thủ..."
                        value={motmDrafts[m.id] ?? myMotm[m.id] ?? ""}
                        onChange={(e) => setMotmDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      />
                      <button className="pick-btn selected shimmer-btn motm-vote-btn" onClick={() => submitMotm(m.id)}>
                        {myMotm[m.id] ? "Cập nhật" : "Bình chọn"}
                      </button>
                    </div>
                    {motmStats[m.id] && Object.keys(motmStats[m.id]).length > 0 && (
                      <div className="motm-list">
                        {Object.entries(motmStats[m.id])
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([name, count]) => (
                            <span key={name} className="motm-chip">{name} · {count} phiếu</span>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {!finishedMatch && locked && <div className="dim small">🔒 Đã khóa dự đoán</div>}
                
                {showBars && (
                  <div className="bars">
                    {["home", "draw", "away"].map((side) => (
                      <div key={side}>
                        <div className="bar-label"><span>{side === "home" ? m.home : side === "draw" ? "Hòa" : m.away}</span><span>{pct(side)}%</span></div>
                        <div className="bar-track"><div className="bar-fill" style={{ width: pct(side) + "%", transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bot Tab */}
      {tab === "bot" && (
        <div className="stack">
          <div className="card pro-card" style={{ textAlign: "center", padding: "24px" }}>
            <img src={PLAYER_AVATARS[0]} alt="Bot" className="avatar-ring player-float" style={{ width: "80px", height: "80px", margin: "0 auto 12px" }} />
            <div className="small">🤖 Điểm của Bot AI</div>
            <div className="bot-score" style={{ fontSize: "2.2rem", color: "#c084fc", fontWeight: "bold", textShadow: "0 0 15px rgba(192,132,252,0.5)" }}>
              {leaderboard.botPoints} điểm
            </div>
          </div>
          {displayLeaderboard.map((r, i) => (
            <div className="card row-between pro-card" key={i}>
              <span>{r.name}</span>
              <span className={r.points > leaderboard.botPoints ? "ok" : r.points === leaderboard.botPoints ? "dim" : "bad"}>
                {r.points} điểm {r.points > leaderboard.botPoints ? "🔥 thắng Bot" : r.points === leaderboard.botPoints ? "= hòa Bot" : "thua Bot"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === "leaderboard" && (
        <div className="stack">
          {displayLeaderboard.length === 0 && <p className="dim">Chưa có điểm nào.</p>}
          {displayLeaderboard.map((r, i) => (
            <div className="card row-between pro-card" key={i}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: "bold", width: "28px", fontSize: "1.1rem" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span> 
                {r.name}
              </span>
              <span className="points" style={{ fontWeight: "bold", color: "#c084fc", fontSize: "1.1rem" }}>{r.points} điểm</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
