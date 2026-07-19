import { useEffect } from 'react';

// Locks background scroll while a modal is open. This isn't just cosmetic —
// on mobile Safari/Chrome, a `position: fixed` element (our modal) can end
// up rendered relative to a stale scrolled state of the page instead of the
// actual visible viewport, which is exactly what made the signature modal
// open "at the edge of the screen, only half visible" on phones. Pinning
// <body> itself with position:fixed for the modal's lifetime keeps the
// layout and visual viewport in sync, so the fixed-position modal centers
// correctly, and restores the scroll position on close.
export function useLockBodyScroll() {
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, []);
}
