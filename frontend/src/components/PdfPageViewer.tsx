import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker using the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

interface Props {
  fileUrl: string;
  pageNumber: number;
  scale?: number;
  onPageSize?: (width: number, height: number) => void;
  onRenderDone?: () => void;
}

export default function PdfPageViewer({ fileUrl, pageNumber, scale = 1.5, onPageSize, onRenderDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!canvasRef.current) return;
      try {
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        onPageSize?.(viewport.width, viewport.height);

        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) onRenderDone?.();
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [fileUrl, pageNumber, scale]);

  if (error) return <div className="alert alert-error">שגיאה בטעינת PDF: {error}</div>;

  return <canvas ref={canvasRef} className="pdf-canvas" />;
}

export { pdfjsLib };
