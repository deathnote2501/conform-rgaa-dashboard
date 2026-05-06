"use client";
import { useState } from "react";
import { ShieldCheck, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });
    if (res.ok) {
      const url = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = url;
    } else {
      setErr("Identifiants invalides");
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark"><ShieldCheck size={16} strokeWidth={2.5} /></span>
          <h1>conform-rgaa dashboard</h1>
        </div>
        <form onSubmit={submit}>
          {err && <div className="err">{err}</div>}
          <label><Mail size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Email</label>
          <input type="email" value={user} onChange={(e) => setUser(e.target.value)} autoFocus required />
          <label><Lock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Mot de passe</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? "..." : "Se connecter"}</button>
        </form>
      </div>
    </div>
  );
}
