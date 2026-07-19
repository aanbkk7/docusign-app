import { useLocation } from 'react-router-dom';

export default function SuccessPage() {
  const location = useLocation();
  const { allSigned, originalName } = (location.state || {}) as { allSigned?: boolean; originalName?: string };

  return (
    <div className="page text-center">
      <div className="container" style={{ maxWidth: 500 }}>
        <div style={{ fontSize: 80, marginBottom: 24 }}>🎉</div>
        <h1 style={{ fontSize: 28, marginBottom: 12, color: 'var(--green)' }}>
          החתימה הושלמה!
        </h1>
        <p style={{ color: 'var(--gray-600)', fontSize: 16 }}>
          {originalName ? `חתמת בהצלחה על "${originalName}".` : 'חתמת בהצלחה על המסמך.'}
        </p>
        <p style={{ color: 'var(--gray-400)', fontSize: 14, marginTop: 8 }}>
          {allSigned
            ? 'כל החותמים סיימו — המסמך ננעל ונשלח לבעל המסמך.'
            : 'נחכה שכל שאר החותמים יסיימו כדי לנעול את המסמך הסופי.'}
        </p>
      </div>
    </div>
  );
}
