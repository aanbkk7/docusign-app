export type FieldType = 'SIGNATURE' | 'INITIALS' | 'DATE' | 'TEXT';

export const FIELD_TYPE_META: Record<FieldType, { icon: string; label: string; defaultW: number; defaultH: number }> = {
  SIGNATURE: { icon: '✍️', label: 'חתימה', defaultW: 0.28, defaultH: 0.06 },
  INITIALS: { icon: '🔤', label: 'ראשי תיבות', defaultW: 0.12, defaultH: 0.05 },
  DATE: { icon: '📅', label: 'תאריך', defaultW: 0.18, defaultH: 0.045 },
  TEXT: { icon: '📝', label: 'טקסט חופשי', defaultW: 0.25, defaultH: 0.045 },
};

export const RECIPIENT_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#ca8a04', // yellow
  '#9333ea', // purple
  '#db2777', // pink
  '#0891b2', // cyan
];

export interface Recipient {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  color: string;
  status?: 'PENDING' | 'VIEWED' | 'SIGNED' | 'DECLINED';
  signingToken?: string;
}

export interface SignatureField {
  id: string;
  recipientId: string;
  type: FieldType;
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  label?: string | null;
  required?: boolean;
  valueImage?: string | null;
  valueText?: string | null;
}

export interface Document {
  id: string;
  originalName: string;
  filePath: string;
  status: 'DRAFT' | 'PENDING' | 'PARTIALLY_SIGNED' | 'SIGNED' | 'DECLINED';
  createdAt: string;
  recipients: Recipient[];
  fields: SignatureField[];
  recipientCount?: number;
  fieldCount?: number;
  signedFilePath?: string | null;
}

export interface SigningDoc {
  id: string;
  originalName: string;
  status: string;
  fileUrl: string;
  recipient: { id: string; name: string; color: string };
  recipients: { id: string; name: string; color: string }[];
  fields: SignatureField[];
}

export interface SendResult {
  recipientId: string;
  name: string;
  signingUrl: string;
  whatsappUrl?: string | null;
  emailSent?: boolean;
  emailError?: string;
  smsSent?: boolean;
  smsError?: string;
}

export interface AuditEvent {
  id: string;
  event: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  recipient?: { name: string; email?: string; phone?: string } | null;
}
