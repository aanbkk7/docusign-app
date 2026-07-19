import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadFile, listDocuments, deleteDocument, downloadSignedPdf, logout } from '../api';
import { Document } from '../types';

export default function HomePage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function handleDownload(doc: Document) {
    setDownloadingId(doc.id);
    setError('');
    try {
      await downloadSignedPdf(doc.id, doc.originalName);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    try { setDocs(await listDocuments()); } catch {}
  }

  async function handleFile(file: File) {
    setError('');
    setLoading(true);
    try {
      const { id } = await uploadFile(file);
      navigate(`/place/${id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את "${name}"?`)) return;
    await deleteDocument(id);
    loadDocs();
  }

  function statusLabel(s: string) {
    if (s === 'DRAFT') return 'טיוטה';
    if (s === 'PENDING') return 'ממתין לחתימה';
    if (s === 'PARTIALLY_SIGNED') return 'נחתם חלקית';
    if (s === 'SIGNED') return 'נחתם';
    if (s === 'DECLINED') return 'סורב';
    return s;
  }

  return (
    <div className="page">
      <div className="container">
        <div className="header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>✍️</span>
            <h1>חתימה דיגיטלית</h1>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>יציאה 🔒</button>
        </div>

        {/* Upload zone */}
        <div className="card">
          <h2 style={{ marginBottom: 20, fontSize: 18 }}>העלה מסמך חדש</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div
            className={`upload-zone${dragOver ? ' drag-over' : ''}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="icon">{loading ? '⏳' : '📄'}</div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>
              {loading ? 'מעלה...' : 'גרור קובץ PDF לכאן'}
            </h3>
            <p>או לחץ לבחירת קובץ</p>
            <p style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
              תומך ב-PDF (לקבצי Word — שמור כ-PDF תחילה)
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>

        {/* Document list */}
        {docs.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>המסמכים שלי</h2>
            <div className="doc-list">
              {docs.map(doc => (
                <div key={doc.id} className="doc-item">
                  <span className="doc-icon">📋</span>
                  <div className="doc-info">
                    <div className="doc-name">{doc.originalName}</div>
                    <div className="doc-date">
                      {new Date(doc.createdAt).toLocaleDateString('he-IL')} ·{' '}
                      {doc.recipientCount || 0} חותמים · {doc.fieldCount || 0} שדות
                    </div>
                  </div>
                  <span className={`badge badge-${doc.status.toLowerCase()}`}>{statusLabel(doc.status)}</span>
                  <div className="doc-actions">
                    {doc.status === 'DRAFT' && (
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/place/${doc.id}`)}>
                        ערוך
                      </button>
                    )}
                    {(doc.status === 'PENDING' || doc.status === 'DECLINED') && (
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/send/${doc.id}`)}>
                        שלח שוב
                      </button>
                    )}
                    {(doc.status === 'PARTIALLY_SIGNED' || doc.status === 'SIGNED') && (
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/send/${doc.id}`)}>
                        פרטים
                      </button>
                    )}
                    {doc.status === 'SIGNED' && doc.signedFilePath && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                      >
                        {downloadingId === doc.id ? '...' : '⬇️ הורד'}
                      </button>
                    )}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--red)' }}
                      onClick={() => handleDelete(doc.id, doc.originalName)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
