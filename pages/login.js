import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    if (typeof window !== "undefined") {
      localStorage.setItem("pl_pending_name", name.trim().slice(0, 24));
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 className="title">⚽ PL Predictor</h1>
        <p className="subtitle">Dự đoán mỗi vòng đấu, so tài với thuật toán, mời bạn bè cùng chơi.</p>
        {sent ? (
          <p className="notice">Đã gửi link đăng nhập tới <b>{email}</b>. Mở email và bấm vào link để vào chơi.</p>
        ) : (
          <form onSubmit={handleLogin} className="auth-form">
            <input
              placeholder="Tên hiển thị (vd: Minh_9)"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="pick-btn selected">Nhận link đăng nhập</button>
            {err && <p className="error-text">{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
