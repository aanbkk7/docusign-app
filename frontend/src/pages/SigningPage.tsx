import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { declineSigning, getSigningDoc, submitSignatures } from '../api';
import { FIELD_TYPE_META, SignatureField, SigningDoc } from '../types';
import PdfPageViewer from '../components/PdfPageViewer';
import SignatureModal from '../components/SignatureModal';
import TextFieldModal from '../components/TextFieldModal';

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<SigningDoc | null>(null);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<SignatureField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [terminalState, setTerminalState] = useState<'signed' | 'declined' | null>(null);

  useEffect(() => {
    if (!token) return;
    getSigningDoc(token)
      .then(d => {
        if (d.status === 'signed') { setTerminalState('signed'); return; }
        if (d.status === 'declined') { setTerminalState('declined'); return; }
        setDoc(d);
        import('pdfjs-dist').then(async pdfjsLib => {
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
          const pdf = await pdfjsLib.getDocument(d.fileUrl).promise;
          setNumPages(pdf.numPages);
        });
      })
      .catch(e => setError(e.message));
  }, [token]);

  const myFields = doc ? doc.fields.filter(f => f.recipientId === doc.recipient.id) : [];
  const allSigned = myFields.length > 0 && myFields.every(f => values[f.id]);

  function handleFieldClick(field: SignatureField) {
    if (values[field.id]) return;
    if (field.type === 'DATE') {
      setValues(prev => ({ ...prev, [field.id]: new Date().toLocaleDateString('he-IL') }));
      return;
    }
    setActiveField(field);
  }

  function handleModalSave(value: string) {
    if (!activeField) return;
    setValues(prev => ({ ...prev, [activeField.id]: value }));
    setActiveField(null);
  }

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await submitSignatures(token, values);
      if (res.allSigned && res.downloadUrl) {
        navigate('/success', { state: { downloadUrl: res.downloadUrl, originalName: res.originalName } });
      } else {
        setTerminalState('signed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!token) return;
    if (!confirm('לסרב לחתום על מסמך זה?')) return;
    await declineSigning(token);
    setTerminalState('declined');
  }

  if (terminalState === 'signed') return (
    <div className="page text-center">
      <div className="container" style={{ maxWidth: 500 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2>תודה, החתימה שלך התקבלה</h2>
        <p className="text-gray" style={{ marginTop: 8 }}>
          נחכה שכל שאר החותמים יסיימו כדי לנעול את המסמך הסופי.
        </p>
      </div>
    </div>
  );

  if (terminalState === 'declined') return (
    <div className="page text-center">
      <div className="container" style={{ maxWidth: 500 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
        <h2>המסמך סורב</h2>
      </div>
    </div>
  );

  if (error) return (
    <div className="page"><div className="container" style={{ maxWidth: 500 }}><div className="alert alert-error">{error}</div></div></div>
  );

  if (!doc) return <div className="page text-center"><div className="container">טוען מסמך...</div></div>;

  return (
    <div className="page">
      <div className="container">
        {/* Sticky so the submit button stays reachable while scrolling through
            a long, multi-page document — signers shouldn't have to scroll
            all the way back to the top to send once every field is done. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderRadius: 'var(--radius)', padding: '16px 24px', marginBottom: 24, boxShadow: 'var(--shadow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: doc.recipient.color, marginInlineEnd: 6 }} />
              {doc.recipient.name} — {doc.originalName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
              {Object.keys(values).length} / {myFields.length} שדות הושלמו
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={handleDecline}>סרב לחתום</button>
            <button
              className={`btn btn-lg ${allSigned ? 'btn-success' : 'btn-outline'}`}
              onClick={handleSubmit}
              disabled={!allSigned || submitting}
            >
              {submitting ? 'שולח...' : allSigned ? '✅ שלח' : `השלם ${myFields.length - Object.keys(values).length} שדות`}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {!allSigned && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            לחץ על השדות המסומנים בצבע שלך במסמך. שדות אפורים שייכים לחותמים אחרים.
          </div>
        )}

        {Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
          <div key={page} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>עמוד {page}</div>
            <div className="pdf-container">
              <PdfPageViewer fileUrl={doc.fileUrl} pageNumber={page} scale={1.4} />
              {doc.fields.filter(f => f.page === page).map(field => {
                const isMine = field.recipientId === doc.recipient.id;
                const owner = doc.recipients.find(r => r.id === field.recipientId);
                const value = values[field.id];
                const meta = FIELD_TYPE_META[field.type];

                if (!isMine) {
                  return (
                    <div
                      key={field.id}
                      className="field-zone"
                      style={{
                        left: `${field.xPct * 100}%`, top: `${field.yPct * 100}%`,
                        width: `${field.widthPct * 100}%`, height: `${field.heightPct * 100}%`,
                        borderColor: owner?.color, color: owner?.color,
                        background: `${owner?.color}14`, opacity: 0.6, pointerEvents: 'none',
                      }}
                    >
                      {meta.icon} {owner?.name}
                    </div>
                  );
                }

                return (
                  <button
                    key={field.id}
                    className={`sig-field-btn${value ? ' signed' : ''}`}
                    style={{
                      left: `${field.xPct * 100}%`, top: `${field.yPct * 100}%`,
                      width: `${field.widthPct * 100}%`, height: `${field.heightPct * 100}%`,
                      borderColor: value ? undefined : doc.recipient.color,
                      color: value ? undefined : doc.recipient.color,
                    }}
                    onClick={() => handleFieldClick(field)}
                  >
                    {value
                      ? (value.startsWith('data:image')
                        ? <img src={value} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
                        : <span style={{ fontSize: 13 }}>{value}</span>)
                      : <>{meta.icon} {meta.label}</>
                    }
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {activeField && (activeField.type === 'SIGNATURE' || activeField.type === 'INITIALS') && (
        <SignatureModal
          title={activeField.type === 'INITIALS' ? 'הזן ראשי תיבות' : 'חתום כאן'}
          penColor={doc.recipient.color}
          onSave={handleModalSave}
          onCancel={() => setActiveField(null)}
        />
      )}
      {activeField && activeField.type === 'TEXT' && (
        <TextFieldModal onSave={handleModalSave} onCancel={() => setActiveField(null)} />
      )}
    </div>
  );
}
