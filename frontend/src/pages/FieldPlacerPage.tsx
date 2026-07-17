import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDocument, saveFields, saveRecipients } from '../api';
import { Document, FIELD_TYPE_META, FieldType, Recipient, SignatureField } from '../types';
import PdfPageViewer from '../components/PdfPageViewer';
import RecipientManager from '../components/RecipientManager';
import FieldPalette from '../components/FieldPalette';

function randomId() {
  return 'tmp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Resolves a viewport point (from a pointer event) to a page + percentage
// position, by asking the DOM what's under the cursor — this is what makes
// the palette chips droppable onto whichever PDF page is underneath them.
function resolveDropTarget(clientX: number, clientY: number): { page: number; xPct: number; yPct: number } | null {
  const el = (document.elementFromPoint(clientX, clientY) as HTMLElement | null)?.closest('[data-page]') as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    page: parseInt(el.dataset.page!, 10),
    xPct: (clientX - rect.left) / rect.width,
    yPct: (clientY - rect.top) / rect.height,
  };
}

export default function FieldPlacerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [activeRecipientId, setActiveRecipientId] = useState<string>('');
  const [numPages, setNumPages] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Drag state: either dropping a brand-new field from the palette, or
  // repositioning one that's already on the page.
  const [dragType, setDragType] = useState<FieldType | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [movingFieldId, setMovingFieldId] = useState<string | null>(null);
  const [resizingFieldId, setResizingFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getDocument(id).then(d => {
      setDoc(d);
      setRecipients(d.recipients || []);
      setFields(d.fields || []);
      setActiveRecipientId(d.recipients?.[0]?.id || '');
      import('pdfjs-dist').then(async pdfjsLib => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
        const pdf = await pdfjsLib.getDocument(`/uploads/${d.filePath}`).promise;
        setNumPages(pdf.numPages);
      });
    });
  }, [id]);

  const activeRecipient = recipients.find(r => r.id === activeRecipientId) || null;

  async function handleRecipientsChange(next: Recipient[]) {
    setRecipients(next); // optimistic — real ids arrive from the server below
    if (!id) return;
    try {
      const saved = await saveRecipients(id, next);
      setRecipients(saved);
      // Any field that pointed at a since-removed recipient is now orphaned — drop it.
      setFields(prev => prev.filter(f => saved.some(r => r.id === f.recipientId)));
      // The server assigns real ids in place of the client's temporary
      // "tmp_..." ones, in the same order — if the active recipient was a
      // newly-added (unsaved) one, follow it to its persisted id.
      if (!saved.some(r => r.id === activeRecipientId)) {
        const idx = next.findIndex(r => r.id === activeRecipientId);
        setActiveRecipientId(saved[idx]?.id || saved[saved.length - 1]?.id || '');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  // --- Dropping a new field from the palette ---------------------------

  function handleChipPointerDown(type: FieldType, e: React.PointerEvent) {
    if (!activeRecipient) return;
    e.preventDefault();
    setDragType(type);
    setDragPos({ x: e.clientX, y: e.clientY });

    const onMove = (ev: PointerEvent) => setDragPos({ x: ev.clientX, y: ev.clientY });
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const target = resolveDropTarget(ev.clientX, ev.clientY);
      if (target) {
        const meta = FIELD_TYPE_META[type];
        const w = meta.defaultW;
        const h = meta.defaultH;
        setFields(prev => [...prev, {
          id: randomId(),
          recipientId: activeRecipient.id,
          type,
          page: target.page,
          xPct: Math.max(0, Math.min(1 - w, target.xPct - w / 2)),
          yPct: Math.max(0, Math.min(1 - h, target.yPct - h / 2)),
          widthPct: w,
          heightPct: h,
          required: true,
        }]);
      }
      setDragType(null);
      setDragPos(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // --- Repositioning an already-placed field ----------------------------

  function handleFieldPointerDown(field: SignatureField, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMovingFieldId(field.id);

    const onMove = (ev: PointerEvent) => {
      const target = resolveDropTarget(ev.clientX, ev.clientY);
      if (!target) return;
      setFields(prev => prev.map(f => f.id !== field.id ? f : {
        ...f,
        page: target.page,
        xPct: Math.max(0, Math.min(1 - f.widthPct, target.xPct - f.widthPct / 2)),
        yPct: Math.max(0, Math.min(1 - f.heightPct, target.yPct - f.heightPct / 2)),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMovingFieldId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // --- Resizing an already-placed field (bottom-right corner handle) ----

  function handleResizePointerDown(field: SignatureField, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation(); // don't also trigger the field's own drag-to-move handler
    const pageEl = (e.currentTarget as HTMLElement).closest('[data-page]') as HTMLElement | null;
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = field.widthPct;
    const startH = field.heightPct;
    setResizingFieldId(field.id);

    const onMove = (ev: PointerEvent) => {
      const dxPct = (ev.clientX - startX) / rect.width;
      const dyPct = (ev.clientY - startY) / rect.height;
      setFields(prev => prev.map(f => f.id !== field.id ? f : {
        ...f,
        widthPct: Math.max(0.04, Math.min(1 - f.xPct, startW + dxPct)),
        heightPct: Math.max(0.025, Math.min(1 - f.yPct, startH + dyPct)),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizingFieldId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function removeField(fieldId: string) {
    setFields(prev => prev.filter(f => f.id !== fieldId));
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await saveFields(id, fields);
      navigate(`/send/${id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!doc) return <div className="page"><div className="container">טוען...</div></div>;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 1100 }}>
        <div className="header">
          <span style={{ fontSize: 28 }}>✍️</span>
          <h1>הגדרת חותמים ושדות חתימה</h1>
        </div>

        <div className="steps">
          <div className="step done"><span className="step-num">✓</span> העלאה</div>
          <div className="step-sep" />
          <div className="step active"><span className="step-num">2</span> חותמים ושדות</div>
          <div className="step-sep" />
          <div className="step"><span className="step-num">3</span> שליחה</div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <RecipientManager
          recipients={recipients}
          activeId={activeRecipientId}
          onChange={handleRecipientsChange}
          onSelectActive={setActiveRecipientId}
        />

        {recipients.length === 0 ? (
          <div className="alert alert-info">הוסף לפחות חותם אחד כדי להתחיל לסמן שדות</div>
        ) : (
          <div className="alert alert-info">
            גרור שדה מהתפריט הימני אל המסמך. השדה יסומן בצבע החותם הפעיל ({activeRecipient?.name}).
          </div>
        )}

        {/* alignItems is intentionally left at the default (stretch), not
            'flex-start' — the sidebar column must be as tall as the (much
            taller) pages column for its sticky palette to have room to
            stick while scrolling. With flex-start the sidebar shrinks to
            its own content height and the sticky element stops following
            the page past that point. */}
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
              <div key={page} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>
                  עמוד {page} מתוך {numPages}
                </div>
                <div className="pdf-container" data-page={page}>
                  <PdfPageViewer
                    fileUrl={`/uploads/${doc.filePath}`}
                    pageNumber={page}
                    scale={1.4}
                  />
                  {fields.filter(f => f.page === page).map(field => {
                    const owner = recipients.find(r => r.id === field.recipientId);
                    const meta = FIELD_TYPE_META[field.type];
                    return (
                      <div
                        key={field.id}
                        className="field-zone"
                        style={{
                          left: `${field.xPct * 100}%`,
                          top: `${field.yPct * 100}%`,
                          width: `${field.widthPct * 100}%`,
                          height: `${field.heightPct * 100}%`,
                          borderColor: owner?.color || '#999',
                          background: `${owner?.color || '#999'}1f`,
                          color: owner?.color || '#999',
                          opacity: movingFieldId === field.id || resizingFieldId === field.id ? 0.6 : 1,
                          cursor: 'grab',
                          touchAction: 'none',
                        }}
                        onPointerDown={e => handleFieldPointerDown(field, e)}
                      >
                        {meta.icon} {owner?.name}
                        <button className="delete-btn" onPointerDown={e => e.stopPropagation()} onClick={() => removeField(field.id)}>×</button>
                        <div
                          className="resize-handle"
                          style={{ borderColor: owner?.color || '#999' }}
                          onPointerDown={e => handleResizePointerDown(field, e)}
                          title="גרור כדי לשנות גודל"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ width: 220, flexShrink: 0 }}>
            <FieldPalette
              activeColor={activeRecipient?.color || '#999'}
              disabled={!activeRecipient}
              onChipPointerDown={handleChipPointerDown}
            />
            <div className="card" style={{ marginTop: 16 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleSave}
                disabled={fields.length === 0 || saving}
              >
                {saving ? 'שומר...' : 'המשך לשליחה →'}
              </button>
              <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/')}>
                ← חזור
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating ghost that follows the pointer while dragging a palette chip */}
      {dragType && dragPos && (
        <div
          className="drag-ghost"
          style={{
            left: dragPos.x,
            top: dragPos.y,
            borderColor: activeRecipient?.color,
            color: activeRecipient?.color,
          }}
        >
          {FIELD_TYPE_META[dragType].icon} {FIELD_TYPE_META[dragType].label}
        </div>
      )}
    </div>
  );
}
