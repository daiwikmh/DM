import { useEffect, useRef } from 'react';

/** Desktop-only replacement for the OS cursor. Positioned via direct style
 * mutation rather than React state — a cursor re-rendering on every
 * mousemove would be needless render churn for something this simple. */
export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed top-0 left-0 z-50 -translate-x-1/2 -translate-y-1/2"
      style={{ mixBlendMode: 'exclusion' }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22.75" stroke="white" strokeWidth="2.5" />
        <path d="M24 16v16M16 24h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
