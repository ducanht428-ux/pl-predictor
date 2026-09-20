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
  const [competition, setCompetition] = useState("PL");
  const COMPETITIONS = { PL: "Premier League", PD: "La Liga", FL1: "Ligue 1", CL: "Champions League" };
  const [matches, setMatches] = useState([]);
  const [myPicks, setMyPicks] = useState({}); // matchId -> { result, home, away }
  const [scoreInputs, setScoreInputs] = useState({}); // matchId -> { home, away } (draft, before saving)
  const [pickStats, setPickStats] = useState({});
  const [motmStats, setMotmStats] = useState({}); // matchId -> { playerName: count }
  const [myMotm, setMyMotm] = useState({}); // matchId -> playerName
  const [motmDrafts, setMotmDrafts] = useState({}); // matchId -> draft text
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
      if (fxRes.error) setNotice("Không lấy được lịch thi đấu thật (" + (fxRes.detail || fxRes.error) + "). Kiểm tra lại FOOTBALL_DATA_API_KEY trên Vercel.");
      else if (lbRes.error) setNotice("Không tính được leaderboard (" + (lbRes.detail || lbRes.error) + ").");

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
  }, [session, competition]);

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
    setMyPicks((prev) => ({ ...prev, [matchId]: { result, home, away } })); // optimistic
    const r = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId, predictedHome: home, predictedAway: away, kickoff }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setNotice(body.error === "locked" ? "Trận này đã bị khóa (trong vòng 8h trước giờ bóng lăn)." : "Không lưu được dự đoán, thử lại nhé.");
      loadAll(); // revert optimistic update to real state
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

    setMyMotm((prev) => ({ ...prev, [matchId]: name })); // optimistic
    const r = await fetch("/api/motm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId, playerName: name }),
    });
    if (!r.ok) {
      setNotice("Không lưu được bình chọn MOTM, thử lại nhé.");
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
            const editable = !locked && !finishedMatch;
            const draft = scoreInputs[m.id] ?? { home: mine?.home ?? "", away: mine?.away ?? "" };

            return (
              <div className="card match-card" key={m.id}>
                <div className="match-top">
                  <span className="teams">{m.home} <span className="vs">vs</span> {m.away}</span>
                  <span className="kickoff">{fmtTime(m.kickoff)}</span>
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
                    <button className="pick-btn selected score-save-btn" onClick={() => submitPick(m.id, m.kickoff)}>
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
                      <button className="pick-btn selected motm-vote-btn" onClick={() => submitMotm(m.id)}>
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
            <svg viewBox="0 0 100 100" className="trophy-icon" xmlns="http://www.w3.org/2000/svg">
              <path d="M30 18h40v25a20 20 0 01-40 0z" fill="var(--accent)" />
              <path d="M30 23h-13a11 11 0 0011 11h2z" fill="var(--accent)" />
              <path d="M70 23h13a11 11 0 01-11 11h-2z" fill="var(--accent)" />
              <rect x="45" y="63" width="10" height="15" fill="var(--accent)" />
              <rect x="33" y="78" width="34" height="8" rx="2" fill="var(--accent)" />
            </svg>
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
