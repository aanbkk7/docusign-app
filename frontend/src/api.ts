import { AuditEvent, Document, Recipient, SendResult, SignatureField, SigningDoc } from './types';

const BASE = '/api';

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<{ id: string; originalName: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/documents/upload`, { method: 'POST', body: form });
  return asJson(res);
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE}/documents`);
  return asJson(res);
}

export async function getDocument(id: string): Promise<Document> {
  const res = await fetch(`${BASE}/documents/${id}`);
  return asJson(res);
}

export async function saveRecipients(id: string, recipients: Recipient[]): Promise<Recipient[]> {
  const res = await fetch(`${BASE}/documents/${id}/recipients`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients }),
  });
  return asJson(res);
}

export async function saveFields(id: string, fields: SignatureField[]): Promise<void> {
  const res = await fetch(`${BASE}/documents/${id}/fields`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  await asJson(res);
}

export async function sendDocument(id: string, frontendUrl?: string): Promise<{ results: SendResult[] }> {
  const res = await fetch(`${BASE}/documents/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frontendUrl }),
  });
  return asJson(res);
}

export async function getAuditTrail(id: string): Promise<AuditEvent[]> {
  const res = await fetch(`${BASE}/documents/${id}/audit`);
  return asJson(res);
}

export async function deleteDocument(id: string): Promise<void> {
  await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' });
}

export async function getSigningDoc(token: string): Promise<SigningDoc> {
  const res = await fetch(`${BASE}/sign/${token}`);
  return asJson(res);
}

export async function submitSignatures(
  token: string,
  values: Record<string, string>
): Promise<{ allSigned: boolean; downloadUrl?: string; originalName: string }> {
  const res = await fetch(`${BASE}/sign/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  return asJson(res);
}

export async function declineSigning(token: string, reason?: string): Promise<void> {
  const res = await fetch(`${BASE}/sign/${token}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  await asJson(res);
}
