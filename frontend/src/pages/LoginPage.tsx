import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../api';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(password);
      const from = (location.state as any)?.from || '/';
      navigate(from, { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page text-center">
      <div className="container" style={{ maxWidth: 380 }}>
        <div className="header" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <h1>כניסת שולח</h1>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
            הזן את הסיסמה כדי לנהל את המסמכים שלך. חותמים שקיבלו קישור לחתימה אינם צריכים סיסמה.
          </p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              autoFocus
              placeholder="סיסמה"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 15, marginBottom: 16 }}
            />
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !password}>
              {loading ? 'בודק...' : 'כניסה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
