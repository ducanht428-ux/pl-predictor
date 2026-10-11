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

const EUROPEAN_STARS = [
  { name: "Haaland", url: "https://crests.football-data.org/65.png", club: "Man City" },
  { name: "Saka", url: "https://crests.football-data.org/57.png", club: "Arsenal" },
  { name: "Mbappé", url: "https://crests.football-data.org/86.png", club: "Real Madrid" },
  { name: "Yamal", url: "https://crests.football-data.org/81.png", club: "Barcelona" },
  { name: "Kane", url: "https://crests.football-data.org/5.png", club: "Bayern Munich" },
  { name: "Palmer", url: "https://crests.football-data.org/61.png", club: "Chelsea" },
];

function getClubLogo(teamName) {
  if (!teamName) return "https://images.fotmob.com/image_resources/logo/team/8192.png";
  const name = teamName.toLowerCase();

  // --- Premier League & EFL ---
  if (name.includes("hull")) return "https://images.fotmob.com/image_resources/logo/team/8346.png";
  if (name.includes("arsenal")) return "https://images.fotmob.com/image_resources/logo/team/9825.png";
  if (name.includes("manchester city") || name.includes("man city")) return "https://images.fotmob.com/image_resources/logo/team/8456.png";
  if (name.includes("manchester united") || name.includes("man utd")) return "https://images.fotmob.com/image_resources/logo/team/10260.png";
  if (name.includes("liverpool")) return "https://images.fotmob.com/image_resources/logo/team/8650.png";
  if (name.includes("chelsea")) return "https://images.fotmob.com/image_resources/logo/team/8455.png";
  if (name.includes("tottenham") || name.includes("spurs")) return "https://images.fotmob.com/image_resources/logo/team/8586.png";
  if (name.includes("newcastle")) return "https://images.fotmob.com/image_resources/logo/team/10261.png";
  if (name.includes("aston villa")) return "https://images.fotmob.com/image_resources/logo/team/10252.png";
  if (name.includes("brighton")) return "https://images.fotmob.com/image_resources/logo/team/10204.png";
  if (name.includes("west ham")) return "https://images.fotmob.com/image_resources/logo/team/8654.png";
  if (name.includes("crystal palace")) return "https://images.fotmob.com/image_resources/logo/team/9826.png";
  if (name.includes("fulham")) return "https://images.fotmob.com/image_resources/logo/team/9879.png";
  if (name.includes("brentford")) return "https://images.fotmob.com/image_resources/logo/team/9937.png";
  if (name.includes("everton")) return "https://images.fotmob.com/image_resources/logo/team/8668.png";
  if (name.includes("nottingham") || name.includes("forest")) return "https://images.fotmob.com/image_resources/logo/team/10281.png";
  if (name.includes("wolves") || name.includes("wolverhampton")) return "https://images.fotmob.com/image_resources/logo/team/8602.png";
  if (name.includes("bournemouth")) return "https://images.fotmob.com/image_resources/logo/team/8678.png";
  if (name.includes("leicester")) return "https://images.fotmob.com/image_resources/logo/team/8197.png";
  if (name.includes("southampton")) return "https://images.fotmob.com/image_resources/logo/team/8466.png";
  if (name.includes("ipswich")) return "https://images.fotmob.com/image_resources/logo/team/8492.png";
  if (name.includes("coventry")) return "https://images.fotmob.com/image_resources/logo/team/8659.png";
  if (name.includes("burnley")) return "https://images.fotmob.com/image_resources/logo/team/8194.png";
  if (name.includes("leeds")) return "https://images.fotmob.com/image_resources/logo/team/8463.png";
  if (name.includes("sunderland")) return "https://images.fotmob.com/image_resources/logo/team/8472.png";

  // --- La Liga ---
  if (name.includes("real madrid")) return "https://images.fotmob.com/image_resources/logo/team/8633.png";
  if (name.includes("barcelona")) return "https://images.fotmob.com/image_resources/logo/team/8634.png";
  if (name.includes("atletico")) return "https://images.fotmob.com/image_resources/logo/team/9906.png";

  // Mặc định trả về logo bóng đá chuẩn, không bao giờ lỗi chữ cái
  return "https://images.fotmob.com/image_resources/logo/team/8192.png";
}

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

      if (!error && data) setRealLeaderboard(data);
    } catch (err) {
      console.error("Lỗi lấy dữ liệu:", err);
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
      setNotice("Không lưu được dự đoán.");
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
    <div className="main-bg">
      <style jsx global>{`
        body {
          background-color: #0b0817;
          color: #f1f5f9;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
        }

        .main-bg {
          min-height: 100vh;
          background: 
            radial-gradient(circle at 20% 20%, rgba(147, 51, 234, 0.22) 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.18) 0%, transparent 45%),
            #08060f;
          background-attachment: fixed;
          padding: 24px 12px;
          display: flex;
          justify-content: center;
        }

        .wrap {
          max-width: 680px;
          width: 100%;
        }

        @keyframes floatUpDown {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }

        .glass-card {
          background: rgba(22, 18, 42, 0.78) !important;
          backdrop-filter: blur(14px);
          border: 1px solid rgba(168, 85, 247, 0.3) !important;
          border-radius: 20px !important;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .team-avatar-img {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2px solid #c084fc;
          background: rgba(255, 255, 255, 0.08);
          object-fit: contain;
          padding: 4px;
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.35);
          animation: floatUpDown 3.5s ease-in-out infinite;
        }

        .shimmer-btn {
          background: linear-gradient(135deg, #9333ea, #6366f1) !important;
          border: none !important;
          color: white !important;
          font-weight: 600;
        }
      `}</style>

      <div className="wrap">
        <div className="header glass-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="title" style={{ margin: 0, background: "linear-gradient(90deg, #c084fc, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ⚽ PL Predictor
            </h1>
            <p className="subtitle" style={{ margin: "4px 0 0 0", color: "#94a3b8" }}>
              Xin chào, <span style={{ color: "#f472b6", fontWeight: "bold" }}>{displayName}</span>
            </p>
          </div>
          <button className="pick-btn shimmer-btn" onClick={logout}>Đăng xuất</button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", margin: "16px 0", flexWrap: "wrap" }}>
          {EUROPEAN_STARS.map((p, idx) => (
            <img 
              key={idx} 
              src={p.url} 
              alt={p.name} 
              title={`${p.name} (${p.club})`}
              className="team-avatar-img" 
              style={{ animationDelay: `${idx * 0.3}s` }}
            />
          ))}
        </div>

        <div className="tabs" style={{ marginBottom: "18px" }}>
          {[["matches", "Trận đấu"], ["bot", "Bot vs Bạn"], ["leaderboard", "Leaderboard"]].map(([k, label]) => (
            <button key={k} className={"tab-btn" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "matches" && (
          <div className="tabs" style={{ marginBottom: "18px" }}>
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

        {notice && <div className="notice-box" style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", borderRadius: "12px", padding: "12px", color: "#fca5a5", marginBottom: "16px" }}>{notice}</div>}
        {loading && <p className="subtitle" style={{ textAlign: "center", color: "#c084fc" }}>⏳ Đang tải dữ liệu trận đấu...</p>}

        {tab === "matches" && (
          <div className="stack">
            {matches.map((m) => {
              const locked = isLocked(m.kickoff);
              const finishedMatch = m.status === "finished";
              const mine = myPicks[m.id];
              const showBars = locked || finishedMatch;
              const stats = pickStats[m.id] || { home: 0, draw: 0, away: 0, total: 0 };
              const pct = (side) => (stats.total ? Math.round((stats[side] / stats.total) * 100) : 0);
              const editable = !locked && !finishedMatch;
              const draft = scoreInputs[m.id] ?? { home: mine?.home ?? "", away: mine?.away ?? "" };

              const homeLogo = m.homeCrest || m.homeCrestUrl || getClubLogo(m.home);
              const awayLogo = m.awayCrest || m.awayCrestUrl || getClubLogo(m.away);

              return (
                <div className="glass-card match-card" key={m.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img 
                        src={homeLogo} 
                        onError={(e) => { e.target.src = "https://images.fotmob.com/image_resources/logo/team/8192.png"; }} 
                        alt={m.home} 
                        className="team-avatar-img" 
                      />
                      <span style={{ fontWeight: "bold", fontSize: "1.05rem" }}>{m.home}</span>
                    </div>

                    <span style={{ fontWeight: "900", color: "#ec4899", fontSize: "1.1rem" }}>VS</span>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontWeight: "bold", fontSize: "1.05rem" }}>{m.away}</span>
                      <img 
                        src={awayLogo} 
                        onError={(e) => { e.target.src = "https://images.fotmob.com/image_resources/logo/team/8192.png"; }} 
                        alt={m.away} 
                        className="team-avatar-img" 
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "center", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "12px" }}>
                    🕒 {fmtTime(m.kickoff)}
                  </div>

                  {editable ? (
                    <div className="score-row" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" }}>
                      <input
                        type="number" min="0" max="30" className="score-input"
                        value={draft.home}
                        onChange={(e) => setScoreInputs((prev) => ({ ...prev, [m.id]: { ...draft, home: e.target.value } }))}
                      />
                      <span style={{ fontWeight: "bold", color: "#c084fc" }}>-</span>
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
                    <div className="result-line" style={{ textAlign: "center", padding: "8px" }}>
                      {mine ? (
                        <>Bạn dự đoán: <b style={{ color: "#38bdf8" }}>{mine.home} - {mine.away}</b></>
                      ) : (
                        <span className="dim">Bạn chưa dự đoán</span>
                      )}
                    </div>
                  )}

                  {finishedMatch && (
                    <div className="result-line" style={{ textAlign: "center", margin: "10px 0" }}>
                      <b>Kết quả thực tế: {m.homeScore} - {m.awayScore}</b>{" "}
                      {mine ? (
                        <span className={mine.result === resultOf[m.id] ? "ok" : "bad"} style={{ marginLeft: "8px", fontWeight: "bold" }}>
                          {mine.result === resultOf[m.id] ? "Đúng (+3 điểm)" : "Sai (-1 điểm)"}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {finishedMatch && (
                    <div className="motm-block" style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                      <div className="small" style={{ color: "#fbbf24", marginBottom: "6px" }}>⭐ Cầu thủ xuất sắc nhất trận</div>
                      <div className="motm-row">
                        <input
                          className="motm-input"
                          placeholder="Nhập tên cầu thủ..."
                          value={motmDrafts[m.id] ?? myMotm[m.id] ?? ""}
                          onChange={(e) => setMotmDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        />
                        <button className="pick-btn selected shimmer-btn motm-vote-btn" onClick={() => submitMotm(m.id)}>
                          {myMotm[m.id] ? "Cập nhật" : "Bình chọn"}
                        </button>
                      </div>
                    </div>
                  )}

                  {!finishedMatch && locked && <div className="dim small" style={{ textAlign: "center", marginTop: "8px" }}>🔒 Đã khóa dự đoán</div>}

                  {showBars && (
                    <div className="bars" style={{ marginTop: "14px" }}>
                      {["home", "draw", "away"].map((side) => (
                        <div key={side} style={{ marginBottom: "6px" }}>
                          <div className="bar-label" style={{ fontSize: "0.8rem", display: "flex", justifyContent: "space-between" }}>
                            <span>{side === "home" ? m.home : side === "draw" ? "Hòa" : m.away}</span>
                            <span>{pct(side)}%</span>
                          </div>
                          <div className="bar-track" style={{ background: "rgba(255,255,255,0.1)", borderRadius: "6px", height: "8px", overflow: "hidden" }}>
                            <div className="bar-fill" style={{ width: pct(side) + "%", background: "linear-gradient(90deg, #a855f7, #38bdf8)", height: "100%", transition: "width 0.8s ease" }} />
                          </div>
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
            <div className="glass-card" style={{ textAlign: "center", padding: "28px" }}>
              <img src="https://images.fotmob.com/image_resources/logo/team/8192.png" alt="Bot AI" className="team-avatar-img" style={{ width: "70px", height: "70px", margin: "0 auto 12px" }} />
              <div className="small" style={{ color: "#94a3b8" }}>🤖 Điểm số của Bot AI</div>
              <div className="bot-score" style={{ fontSize: "2.4rem", color: "#c084fc", fontWeight: "bold" }}>
                {leaderboard.botPoints} điểm
              </div>
            </div>
            {displayLeaderboard.map((r, i) => (
              <div className="glass-card row-between" key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: "600" }}>{r.name}</span>
                <span className={r.points > leaderboard.botPoints ? "ok" : r.points === leaderboard.botPoints ? "dim" : "bad"} style={{ fontWeight: "bold" }}>
                  {r.points} điểm {r.points > leaderboard.botPoints ? "🔥 thắng Bot" : r.points === leaderboard.botPoints ? "= hòa Bot" : "thua Bot"}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "leaderboard" && (
          <div className="stack">
            {displayLeaderboard.length === 0 && <p className="dim" style={{ textAlign: "center" }}>Chưa có điểm nào.</p>}
            {displayLeaderboard.map((r, i) => (
              <div className="glass-card row-between" key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "1.05rem" }}>
                  <span style={{ fontWeight: "bold", width: "28px" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span> 
                  {r.name}
                </span>
                <span className="points" style={{ fontWeight: "bold", color: "#38bdf8", fontSize: "1.1rem" }}>{r.points} điểm</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
