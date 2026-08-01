import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { GALLERY_IMAGES } from './content.ts';
import { buildLayout } from './layout.ts';

export interface GalleryHandle {
  /** Called every RAF frame by the parent — cheap arithmetic against cached
   * metrics, no DOM reads, so this can run at 60fps without layout thrashing. */
  updateCards(effectiveOffsetPx: number, vh: number): void;
  /** Phase-2 "inner wrapper" translateY — 0 during phase 1, since the panel's
   * own GSAP-driven slide already carries this wrapper along with it. */
  setWrapperOffset(px: number): void;
}

interface GalleryProps {
  onWrapperHeightChange: (height: number) => void;
}

export const Gallery = forwardRef<GalleryHandle, GalleryProps>(function Gallery(
  { onWrapperHeightChange },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardMetrics = useRef<{ top: number; height: number }[]>([]);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const computeCols = () => {
      const w = window.innerWidth;
      setCols(w < 640 ? 2 : w < 1024 ? 3 : 4);
    };
    computeCols();
    window.addEventListener('resize', computeCols);
    return () => window.removeEventListener('resize', computeCols);
  }, []);

  const layout = useMemo(() => buildLayout(GALLERY_IMAGES.length, cols), [cols]);
  const cells = useMemo(() => layout.flat(), [layout]);

  useEffect(() => {
    const measure = () => {
      cardMetrics.current = cardRefs.current.map((el) =>
        el ? { top: el.offsetTop, height: el.offsetHeight } : { top: 0, height: 0 },
      );
      if (wrapperRef.current) onWrapperHeightChange(wrapperRef.current.scrollHeight);
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [layout, onWrapperHeightChange]);

  useImperativeHandle(ref, () => ({
    updateCards(effectiveOffsetPx, vh) {
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const metrics = cardMetrics.current[i];
        if (!metrics) return;

        const screenTop = effectiveOffsetPx + metrics.top;
        const screenBottom = screenTop + metrics.height;

        if (screenBottom <= 0 || screenTop >= vh) {
          el.style.transform = 'scale(0)';
          return;
        }

        const enter = Math.min(1, (vh - screenTop) / (vh * 0.6));
        const exit = Math.min(1, screenBottom / (vh * 0.4));
        el.style.transform = `scale(${Math.max(0, Math.min(enter, exit))})`;
      });
    },
    setWrapperOffset(px) {
      if (wrapperRef.current) wrapperRef.current.style.transform = `translateY(${px}px)`;
    },
  }));

  let cardIndex = -1;

  return (
    <div ref={wrapperRef} className="w-full" style={{ paddingTop: 'min(400px, 40vh)' }}>
      <div
        className="grid gap-4 px-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cells.map((imageIndex, cellIndex) => {
          if (imageIndex === -1) return <div key={cellIndex} />;

          cardIndex += 1;
          const slot = cardIndex;
          const col = cellIndex % cols;
          const isLeftHalf = col < cols / 2;

          return (
            <div
              key={cellIndex}
              ref={(el) => {
                cardRefs.current[slot] = el;
              }}
              className="bp-card aspect-[2/3] overflow-hidden will-change-transform"
              style={{ transform: 'scale(0)', transformOrigin: isLeftHalf ? 'right bottom' : 'left bottom' }}
            >
              <img
                src={GALLERY_IMAGES[imageIndex]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
