import { AuditEvent, Document, Recipient, SendResult, SignatureField, SigningDoc } from './types';

const BASE = '/api';
const AUTH_STORAGE_KEY = 'senderPassword';

// On the free hosting tier the server goes to sleep when idle, and while it
// wakes up (up to ~1 minute) the hosting proxy answers with its own HTML
// "starting up" page (or a 502/503/504) instead of our JSON — which used to
// surface as 'Unexpected token "<" ... is not valid JSON'. Our app never
// returns HTML from /api, so an HTML/gateway response means the request
// never reached it; it's safe to wait and retry (even for uploads).
async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const maxAttempts = 5;
  let lastInfo = 'אין חיבור לשרת';
  for (let attempt = 1; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(input, init);
    } catch (e: any) {
      // network hiccup while the server is waking up — treat like a gateway miss
      lastInfo = `שגיאת רשת: ${e?.message || 'לא ידועה'}`;
    }
    const contentType = res?.headers.get('content-type') || '';
    const isGatewayMiss =
      !res ||
      [502, 503, 504].includes(res.status) ||
      contentType.includes('text/html');
    if (!isGatewayMiss) return res!;
    if (res) {
      const snippet = (await res.clone().text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120);
      lastInfo = `קוד ${res.status}, ${contentType || 'ללא סוג'}: ${snippet}`;
      // A *successful* (200) HTML page in answer to an /api call can't come
      // from our server or from a waking host (those answer 5xx) — it's
      // something between the browser and the server (an internet filter,
      // firewall or captive portal) replying in its place. Retrying won't
      // change that, so say so right away instead of waiting.
      if (res.status === 200 && contentType.includes('text/html')) {
        throw new Error(
          'הבקשה נחסמה בדרך לשרת — כנראה על ידי סינון אינטרנט או חומת אש ברשת/במחשב שלך, ' +
          'ולא על ידי האפליקציה. (נסה רשת אחרת, למשל נקודה חמה מהטלפון, או בקש מספק הסינון לאשר את האתר.)'
        );
      }
    }
    if (attempt >= maxAttempts) {
      throw new Error(`השרת לא הגיב כראוי (${lastInfo}). נסה שוב בעוד דקה.`);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
}

// --- Sender auth -----------------------------------------------------
// One shared password gates every sender-facing route (list/upload/prepare/
// send/delete/download). There's no session/expiry by design — "unlimited
// access" once you're in — the browser just keeps resending the same
// password as a Bearer token. Recipients never touch this: their whole
// "login" is the unguessable /sign/:token link, which hits a completely
// separate, unauthenticated set of routes.

export function getStoredPassword(): string | null {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

export function isLoggedIn(): boolean {
  return !!getStoredPassword();
}

export function logout(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function login(password: string): Promise<void> {
  const res = await apiFetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error || 'Login failed');
  }
  localStorage.setItem(AUTH_STORAGE_KEY, password);
}

async function asJson<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Stored password is missing/wrong (or was never set) — send back to
    // the login screen instead of surfacing a raw 401 in the UI.
    logout();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('נדרשת התחברות מחדש');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const password = getStoredPassword();
  return {
    ...(password ? { Authorization: `Bearer ${password}` } : {}),
    ...extra,
  };
}

export async function uploadFile(file: File): Promise<{ id: string; originalName: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch(`${BASE}/documents/upload`, { method: 'POST', headers: authHeaders(), body: form });
  return asJson(res);
}

export async function listDocuments(): Promise<Document[]> {
  const res = await apiFetch(`${BASE}/documents`, { headers: authHeaders() });
  return asJson(res);
}

export async function getDocument(id: string): Promise<Document> {
  const res = await apiFetch(`${BASE}/documents/${id}`, { headers: authHeaders() });
  return asJson(res);
}

export async function saveRecipients(id: string, recipients: Recipient[]): Promise<Recipient[]> {
  const res = await apiFetch(`${BASE}/documents/${id}/recipients`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ recipients }),
  });
  return asJson(res);
}

export async function saveFields(id: string, fields: SignatureField[]): Promise<void> {
  const res = await apiFetch(`${BASE}/documents/${id}/fields`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fields }),
  });
  await asJson(res);
}

export async function sendDocument(id: string, frontendUrl?: string): Promise<{ results: SendResult[] }> {
  const res = await apiFetch(`${BASE}/documents/${id}/send`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ frontendUrl }),
  });
  return asJson(res);
}

export async function getAuditTrail(id: string): Promise<AuditEvent[]> {
  const res = await apiFetch(`${BASE}/documents/${id}/audit`, { headers: authHeaders() });
  return asJson(res);
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch(`${BASE}/documents/${id}`, { method: 'DELETE', headers: authHeaders() });
}

// Downloads go through fetch (not a plain <a href>) specifically so the
// Bearer token actually gets sent — a bare hyperlink can't carry an
// Authorization header, and there is no unauthenticated URL for a signed
// PDF anymore.
export async function downloadSignedPdf(id: string, suggestedName: string): Promise<void> {
  const res = await apiFetch(`${BASE}/documents/${id}/download`, { headers: authHeaders() });
  if (res.status === 401) {
    logout();
    window.location.href = '/login';
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Recipient-facing (unauthenticated, token-scoped) -----------------

export async function getSigningDoc(token: string): Promise<SigningDoc> {
  const res = await apiFetch(`${BASE}/sign/${token}`);
  return asJson(res);
}

export async function submitSignatures(
  token: string,
  values: Record<string, string>
): Promise<{ allSigned: boolean; originalName: string }> {
  const res = await apiFetch(`${BASE}/sign/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  return asJson(res);
}

export async function declineSigning(token: string, reason?: string): Promise<void> {
  const res = await apiFetch(`${BASE}/sign/${token}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  await asJson(res);
}
