import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDocument, sendDocument } from '../api';
import { Document, SendResult } from '../types';

export default function SendPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [networkUrl, setNetworkUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getDocument(id).then(setDoc);
    fetch('/api/local-ip')
      .then(r => r.json())
      .then(d => setNetworkUrl(d.frontendUrl))
      .catch(() => setNetworkUrl(window.location.origin));
  }, [id]);

  const effectiveBaseUrl = customUrl.trim() || networkUrl || window.location.origin;

  async function handleSend() {
    if (!id) return;
    setSending(true);
    setError('');
    try {
      const res = await sendDocument(id, effectiveBaseUrl);
      setResults(res.results);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function copyUrl(url: string, recipientId: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(recipientId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (!doc) return <div className="page"><div className="container">טוען...</div></div>;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="header">
          <span style={{ fontSize: 28 }}>📤</span>
          <h1>שליחה לחתימה</h1>
        </div>

        <div className="steps">
          <div className="step done"><span className="step-num">✓</span> העלאה</div>
          <div className="step-sep" />
          <div className="step done"><span className="step-num">✓</span> חותמים ושדות</div>
          <div className="step-sep" />
          <div className="step active"><span className="step-num">3</span> שליחה</div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 28 }}>📋</span>
            <div>
              <div style={{ fontWeight: 700 }}>{doc.originalName}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                {doc.recipients.length} חותמים · {doc.fields.length} שדות חתימה
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>חותמים</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {doc.recipients.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                  {r.email || r.phone || 'ללא פרטי קשר'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {!results ? (
          <div className="card">
            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--gray-600)' }}>
                📡 איך הנמענים יפתחו את הקישור?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 'var(--radius)', border: `1.5px solid ${!showCustomUrl ? 'var(--blue)' : 'var(--gray-200)'}`, background: !showCustomUrl ? 'var(--blue-light)' : 'white' }}>
                  <input type="radio" name="mode" checked={!showCustomUrl} onChange={() => setShowCustomUrl(false)} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>📶 WiFi פנימי — אותה רשת בלבד</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>
                      {networkUrl ? `כתובת: ${networkUrl}` : 'טוען כתובת רשת...'}
                    </div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 'var(--radius)', border: `1.5px solid ${showCustomUrl ? 'var(--blue)' : 'var(--gray-200)'}`, background: showCustomUrl ? 'var(--blue-light)' : 'white' }}>
                  <input type="radio" name="mode" checked={showCustomUrl} onChange={() => setShowCustomUrl(true)} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>🌐 ngrok — גישה מכל מקום (אינטרנט)</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>
                      הרץ <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 3 }}>npx ngrok http 5173</code> והדבק את הכתובת כאן
                    </div>
                    {showCustomUrl && (
                      <input
                        type="url"
                        placeholder="https://xxxx-xx-xx.ngrok-free.app"
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        style={{ marginTop: 8, width: '100%', padding: '8px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 13, direction: 'ltr' }}
                        autoFocus
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => navigate(`/place/${id}`)}>← חזור</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSend} disabled={sending}>
                {sending ? 'שולח...' : `שלח לכל ${doc.recipients.length} החותמים ✈️`}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2 style={{ fontSize: 18, marginBottom: 20, color: 'var(--green)' }}>✅ קישורי החתימה נשלחו!</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {results.map(r => (
                <div key={r.recipientId} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{r.name}</div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      readOnly
                      value={r.signingUrl}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      style={{ flex: 1, padding: '7px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 12, background: 'var(--gray-50)', direction: 'ltr', textAlign: 'left' }}
                    />
                    <button className="btn btn-outline btn-sm" onClick={() => copyUrl(r.signingUrl, r.recipientId)}>
                      {copiedId === r.recipientId ? '✓ הועתק' : 'העתק'}
                    </button>
                  </div>

                  {r.whatsappUrl && (
                    <a href={r.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm" style={{ textDecoration: 'none', marginBottom: 6 }}>
                      📱 פתח WhatsApp
                    </a>
                  )}

                  {r.emailSent !== undefined && (
                    r.emailSent
                      ? <div className="alert alert-success" style={{ margin: '6px 0 0', padding: '6px 10px', fontSize: 12 }}>📧 נשלח מייל</div>
                      : <div className="alert alert-error" style={{ margin: '6px 0 0', padding: '6px 10px', fontSize: 12 }}>שגיאת מייל: {r.emailError}</div>
                  )}
                  {r.smsSent !== undefined && (
                    r.smsSent
                      ? <div className="alert alert-success" style={{ margin: '6px 0 0', padding: '6px 10px', fontSize: 12 }}>💬 נשלח SMS</div>
                      : <div className="alert alert-error" style={{ margin: '6px 0 0', padding: '6px 10px', fontSize: 12 }}>שגיאת SMS: {r.smsError}</div>
                  )}
                </div>
              ))}
            </div>

            <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => navigate('/')}>← חזור לדף הבית</button>
          </div>
        )}
      </div>
    </div>
  );
}
