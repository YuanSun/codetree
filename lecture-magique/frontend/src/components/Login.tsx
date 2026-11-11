import { FormEvent, useState } from "react";
import { api, Me } from "../api";

export default function Login({ onLogin }: { onLogin: (m: Me) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await api.login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="logo">📖✨</div>
        <h1>Lecture Magique</h1>
        <label>
          Prénom
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none"
                 autoCorrect="off" autoComplete="username" required />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="current-password" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "…" : "Entrer"}</button>
      </form>
    </main>
  );
}
