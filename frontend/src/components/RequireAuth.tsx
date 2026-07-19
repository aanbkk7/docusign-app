import { Navigate, useLocation } from 'react-router-dom';
import { isLoggedIn } from '../api';

// Gates the sender-facing pages (home, field placer, send). Only checks
// that *a* password is stored — if it's stale or wrong, the first API call
// on the page will 401 and api.ts's asJson() bounces back to /login anyway.
// /sign/:token and /success are intentionally never wrapped in this: a
// recipient's access is scoped by their token alone, not this password.
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
