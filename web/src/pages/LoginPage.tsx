import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(username, password);
      else await signup(username, password, email || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card panel">
        <div className="auth-brand">
          RIP<span className="gold">.</span>
        </div>
        <div className="auth-tag">rip · battle · build</div>
        <form onSubmit={submit} className="col" style={{ gap: 14, marginTop: 20 }}>
          <div className="col" style={{ gap: 6 }}>
            <label className="label">{mode === 'login' ? 'Username or email' : 'Username'}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          {mode === 'signup' && (
            <div className="col" style={{ gap: 6 }}>
              <label className="label">Email (optional)</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}
          <div className="col" style={{ gap: 6 }}>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-gold btn-lg" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <div className="auth-switch muted">
          {mode === 'login' ? (
            <>
              New here? <a onClick={() => setMode('signup')}>Create an account</a>
            </>
          ) : (
            <>
              Have an account? <a onClick={() => setMode('login')}>Log in</a>
            </>
          )}
        </div>
        <div className="auth-demo muted">
          Demo login: <span className="mono">demo / demo1234</span>
        </div>
      </div>
    </div>
  );
}
