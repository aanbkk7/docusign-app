import { useState } from 'react';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface Props {
  onSave: (value: string) => void;
  onCancel: () => void;
}

export default function TextFieldModal({ onSave, onCancel }: Props) {
  const [value, setValue] = useState('');
  useLockBodyScroll();

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <h3>📝 הזן טקסט</h3>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onSave(value.trim()); }}
          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 15 }}
        />
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>ביטול</button>
          <button className="btn btn-primary" onClick={() => onSave(value.trim())} disabled={!value.trim()}>אישור</button>
        </div>
      </div>
    </div>
  );
}
