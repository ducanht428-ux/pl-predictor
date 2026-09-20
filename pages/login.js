import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    if (mode === "signup") {
      if (typeof window !== "undefined") {
        localStorage.setItem("pl_pending_name", name.trim().slice(0, 24));
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setErr(error.message);
      // On success, Supabase either logs the user in immediately (if
      // "Confirm email" is off) or the onAuthStateChange listener on
      // the main page will pick up the session once it's created.
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
    }
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <svg viewBox="0 0 240 200" className="hero-illustration" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="120" cy="180" rx="80" ry="10" fill="var(--border)" opacity="0.6" />
          <circle cx="118" cy="50" r="17" fill="var(--accent)" />
          <path d="M100 68 Q120 58 138 70 L143 122 Q118 132 98 122 Z" fill="var(--accent)" />
          <path d="M98 80 L72 90 L75 100 L104 93 Z" fill="var(--accent)" />
          <path d="M138 80 L162 72 L165 82 L141 92 Z" fill="var(--accent)" />
          <rect x="103" y="120" width="15" height="50" rx="7" fill="var(--accent)" />
          <path d="M126 120 L160 140 L172 130 L180 140 L160 158 L118 136 Z" fill="var(--accent)" />
          <circle cx="188" cy="146" r="13" fill="var(--away)" />
          <path d="M188 137 L194 141 L192 148 L184 148 L182 141 Z" fill="var(--bg-card)" />
        </svg>
        <h1 className="title">⚽ PL Predictor</h1>
        <p className="subtitle">Dự đoán mỗi vòng đấu, so tài với thuật toán, mời bạn bè cùng chơi.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <input
              placeholder="Tên hiển thị (vd: Minh_9)"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email của bạn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mật khẩu (ít nhất 6 ký tự)"
            value={password}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="pick-btn selected" disabled={loading}>
            {loading ? "Đang xử lý..." : mode === "signup" ? "Tạo tài khoản & vào chơi" : "Đăng nhập"}
          </button>
          {err && <p className="error-text">{err}</p>}
        </form>

        <p className="notice">
          {mode === "signup" ? (
            <>Đã có tài khoản?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode("signin"); setErr(""); }}>Đăng nhập</a>
            </>
          ) : (
            <>Chưa có tài khoản?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setErr(""); }}>Tạo tài khoản</a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
