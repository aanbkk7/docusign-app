import { FIELD_TYPE_META, FieldType } from '../types';

interface Props {
  activeColor: string;
  disabled: boolean;
  onChipPointerDown: (type: FieldType, e: React.PointerEvent) => void;
}

const TYPES: FieldType[] = ['SIGNATURE', 'INITIALS', 'DATE', 'TEXT'];

// The draggable source: each chip is picked up with a pointer (mouse or
// touch — Pointer Events unify both) and dropped onto a PDF page in
// FieldPlacerPage, which turns the drop point into a signature-zone field.
export default function FieldPalette({ activeColor, disabled, onChipPointerDown }: Props) {
  return (
    <div className="card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>שדות לגרירה</h3>
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>
        {disabled ? 'בחר חותם למעלה תחילה' : 'גרור שדה אל המסמך'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TYPES.map(type => {
          const meta = FIELD_TYPE_META[type];
          return (
            <div
              key={type}
              className="palette-chip"
              style={{
                borderColor: activeColor,
                color: activeColor,
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'grab',
                touchAction: 'none',
              }}
              onPointerDown={e => !disabled && onChipPointerDown(type, e)}
            >
              <span style={{ fontSize: 18 }}>{meta.icon}</span>
              {meta.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
