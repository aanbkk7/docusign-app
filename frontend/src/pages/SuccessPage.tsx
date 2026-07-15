import { useLocation, useNavigate } from 'react-router-dom';

export default function SuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { downloadUrl, originalName } = (location.state || {}) as { downloadUrl?: string; originalName?: string };

  return (
    <div className="page text-center">
      <div className="container" style={{ maxWidth: 500 }}>
        <div style={{ fontSize: 80, marginBottom: 24 }}>🎉</div>
        <h1 style={{ fontSize: 28, marginBottom: 12, color: 'var(--green)' }}>
          החתימה הושלמה!
        </h1>
        <p style={{ color: 'var(--gray-600)', fontSize: 16, marginBottom: 32 }}>
          {originalName ? `"${originalName}" נחתם בהצלחה.` : 'המסמך נחתם בהצלחה.'}
        </p>

        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="btn btn-success btn-lg"
            style={{ display: 'inline-flex', marginBottom: 16 }}
          >
            ⬇️ הורד מסמך חתום
          </a>
        )}

        <div>
          <button className="btn btn-outline" onClick={() => navigate('/')}>
            חזור לדף הבית
          </button>
        </div>
      </div>
    </div>
  );
}
