import { useEffect, useRef, useState } from 'react';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface Props {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  title?: string;
  penColor?: string;
}

// HTML5 canvas signature pad. Uses the Pointer Events API (not separate
// mouse/touch handlers) so mouse, touch, and stylus input all go through one
// code path, and scales the backing store by devicePixelRatio so strokes
// stay crisp on retina/high-DPI phones instead of blurring when the CSS
// size and the canvas pixel size don't match.
export default function SignatureModal({ onSave, onCancel, title = 'חתום כאן', penColor = '#1e3a8a' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [isEmpty, setIsEmpty] = useState(true);

  useLockBodyScroll();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const cssWidth = canvas.clientWidth;
    const cssHeight = 180;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    rectRef.current = canvas.getBoundingClientRect();
  }, [penColor]);

  function getPos(e: React.PointerEvent): { x: number; y: number } {
    const rect = rectRef.current!;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = getPos(e);
    setIsEmpty(false);
  }

  function draw(e: React.PointerEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw(e: React.PointerEvent) {
    e.preventDefault();
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setIsEmpty(true);
  }

  function save() {
    onSave(canvasRef.current!.toDataURL('image/png'));
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>✍️ {title}</h3>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12 }}>
          השתמש בעכבר, אצבע או עט כדי לחתום
        </p>
        <div className="sig-canvas-wrap">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 180, display: 'block' }}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={clear}>נקה</button>
          <button className="btn btn-outline" onClick={onCancel}>ביטול</button>
          <button className="btn btn-primary" onClick={save} disabled={isEmpty}>אישור</button>
        </div>
      </div>
    </div>
  );
}
