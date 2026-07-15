import { useState } from 'react';
import { Recipient, RECIPIENT_COLORS } from '../types';

function randomId() {
  return 'tmp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface Props {
  recipients: Recipient[];
  activeId: string | null;
  onChange: (recipients: Recipient[]) => void;
  onSelectActive: (id: string) => void;
}

// Lets the sender add multiple signers, color-code each one, and pick which
// signer new fields get assigned to while dragging placeholders (below).
export default function RecipientManager({ recipients, activeId, onChange, onSelectActive }: Props) {
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });

  function nextColor() {
    return RECIPIENT_COLORS[recipients.length % RECIPIENT_COLORS.length];
  }

  function addRecipient() {
    if (!draft.name.trim()) return;
    const recipient: Recipient = {
      id: randomId(),
      name: draft.name.trim(),
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      color: nextColor(),
    };
    const updated = [...recipients, recipient];
    onChange(updated);
    onSelectActive(recipient.id);
    setDraft({ name: '', email: '', phone: '' });
  }

  function removeRecipient(id: string) {
    onChange(recipients.filter(r => r.id !== id));
    if (activeId === id) {
      const remaining = recipients.filter(r => r.id !== id);
      onSelectActive(remaining[0]?.id || '');
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 12 }}>חותמים על המסמך</h3>

      {recipients.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {recipients.map(r => (
            <button
              key={r.id}
              className="recipient-chip"
              style={{
                borderColor: r.color,
                background: activeId === r.id ? r.color : 'white',
                color: activeId === r.id ? 'white' : r.color,
              }}
              onClick={() => onSelectActive(r.id)}
              title="בחר כדי לגרור עבורו שדות"
            >
              <span className="dot" style={{ background: activeId === r.id ? 'white' : r.color }} />
              {r.name}
              <span className="remove-x" onClick={e => { e.stopPropagation(); removeRecipient(r.id); }}>×</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="שם החותם"
          value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
          style={{ flex: '1 1 140px', padding: '8px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14 }}
        />
        <input
          placeholder="אימייל (אופציונלי)"
          value={draft.email}
          onChange={e => setDraft({ ...draft, email: e.target.value })}
          style={{ flex: '1 1 160px', padding: '8px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14, direction: 'ltr' }}
        />
        <input
          placeholder="טלפון (אופציונלי)"
          value={draft.phone}
          onChange={e => setDraft({ ...draft, phone: e.target.value })}
          style={{ flex: '1 1 140px', padding: '8px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14, direction: 'ltr' }}
        />
        <button className="btn btn-outline btn-sm" onClick={addRecipient} disabled={!draft.name.trim()}>
          + הוסף חותם
        </button>
      </div>

      {recipients.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 10 }}>
          החותם המסומן למטה הוא זה שאליו ישויכו שדות חדשים שתגרור למסמך.
        </p>
      )}
    </div>
  );
}
