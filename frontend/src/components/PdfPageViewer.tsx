import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { RenderTask } from 'pdfjs-dist';

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
    // pdf.js gives us a cancellable RenderTask specifically so a component
    // can abort a render that's still in flight. Without calling .cancel()
    // here, React.StrictMode's intentional mount→unmount→remount in dev (and
    // any real rapid prop change in production — fast scrolling, quick page
    // switches) can leave two render() calls drawing to the *same* canvas
    // 2D context at once. Two interleaved render passes is exactly what
    // produces ghosted double-exposed text and a table that looks shifted/
    // garbled — the PDF itself was never actually corrupted.
    let renderTask: RenderTask | null = null;

    async function render() {
      if (!canvasRef.current) return;
      try {
        // cMapUrl/standardFontDataUrl are required for PDFs with embedded
        // CID/Type0 fonts (very common in Hebrew documents) or non-embedded
        // standard fonts. Without them pdf.js silently substitutes a
        // fallback font with different glyph widths.
        //
        // disableFontFace: some embedded, subsetted CID/TrueType fonts
        // (notably ones produced by "Print to PDF" flows) trip up the
        // browser's native @font-face + fillText() path pdf.js normally
        // uses — specific glyphs render as the wrong character or a
        // replacement glyph. Setting this makes pdf.js paint each glyph as
        // an explicit vector path instead, which is slower but bypasses
        // the browser font engine entirely and renders exactly what the
        // embedded font program actually contains.
        const pdf = await pdfjsLib.getDocument({
          url: fileUrl,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
          disableFontFace: true,
        }).promise;
        if (cancelled) return;

        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        onPageSize?.(viewport.width, viewport.height);

        const ctx = canvas.getContext('2d')!;
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
        if (!cancelled) onRenderDone?.();
      } catch (e: any) {
        // Our own cleanup cancels the render task below, which rejects its
        // promise with this specific error — that's expected, not a failure.
        if (!cancelled && e?.name !== 'RenderingCancelledException') {
          setError(e.message);
        }
      }
    }
    render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [fileUrl, pageNumber, scale]);

  if (error) return <div className="alert alert-error">שגיאה בטעינת PDF: {error}</div>;

  return <canvas ref={canvasRef} className="pdf-canvas" />;
}

export { pdfjsLib };
