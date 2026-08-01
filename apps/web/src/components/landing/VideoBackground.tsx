import { useEffect, useRef, useState } from 'react';
import { VIDEO_LEFT, VIDEO_RIGHT } from './content.ts';
import { useDeviceMode } from './useDeviceMode.ts';

type Side = 'left' | 'right';

export function VideoBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);
  const activeSideRef = useRef<Side>('right'); // right is visible by default per spec
  const mouseXRef = useRef<number | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const { isDesktop, prefersReducedMotion } = useDeviceMode();

  useEffect(() => {
    if (loadedCount >= 2 && containerRef.current) containerRef.current.style.opacity = '1';
  }, [loadedCount]);

  const onLoaded = () => setLoadedCount((c) => c + 1);

  // A dead video URL (as happened 2026-08-01 — the prior placeholders started
  // 403ing) must not leave the container permanently invisible; count it as
  // settled so the overlay still reveals rather than hanging at opacity-0.
  const onError = () => setLoadedCount((c) => c + 1);

  // Desktop: cursor-position scrubs whichever video is active. RAF-driven,
  // not a mousemove-triggered render — mousemove only records the x
  // coordinate, matching the spec's "only update when !video.seeking" guard.
  useEffect(() => {
    if (!isDesktop) return;

    const onMove = (e: MouseEvent) => {
      mouseXRef.current = e.clientX;
    };
    window.addEventListener('mousemove', onMove);

    let raf = requestAnimationFrame(function tick() {
      const left = leftRef.current;
      const right = rightRef.current;
      const x = mouseXRef.current;

      if (left && right && x !== null) {
        const width = window.innerWidth;
        const center = width / 2;
        const deadZone = Math.max(30, width * 0.05);

        let progress = 0;
        if (x < center - deadZone) {
          activeSideRef.current = 'right';
          const range = center - deadZone;
          progress = range > 0 ? (range - x) / range : 0;
        } else if (x > center + deadZone) {
          activeSideRef.current = 'left';
          const range = width - (center + deadZone);
          progress = range > 0 ? (x - (center + deadZone)) / range : 0;
        }
        // else: inside the dead zone — activeSideRef stays put, progress resets to 0.

        const active = activeSideRef.current === 'left' ? left : right;
        const inactive = activeSideRef.current === 'left' ? right : left;
        active.style.display = 'block';
        inactive.style.display = 'none';

        if (Number.isFinite(active.duration) && !active.seeking) {
          active.currentTime = Math.min(progress, 0.999) * active.duration;
        }
      }

      raf = requestAnimationFrame(tick);
    });

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [isDesktop]);

  // Touch: alternate autoplay, left first.
  useEffect(() => {
    if (isDesktop || prefersReducedMotion) return;

    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    left.style.display = 'block';
    right.style.display = 'none';
    left.currentTime = 0;
    left.play().catch(() => {});

    const onLeftEnded = () => {
      left.style.display = 'none';
      right.style.display = 'block';
      right.currentTime = 0;
      right.play().catch(() => {});
    };
    const onRightEnded = () => {
      right.style.display = 'none';
      left.style.display = 'block';
      left.currentTime = 0;
      left.play().catch(() => {});
    };

    left.addEventListener('ended', onLeftEnded);
    right.addEventListener('ended', onRightEnded);
    return () => {
      left.removeEventListener('ended', onLeftEnded);
      right.removeEventListener('ended', onRightEnded);
    };
  }, [isDesktop, prefersReducedMotion]);

  return (
    <div
      id="main-canvas"
      ref={containerRef}
      className="pointer-events-none fixed top-[220px] left-0 z-0 h-[calc(100vh-220px)] w-screen overflow-hidden bg-black opacity-0 transition-opacity duration-300 lg:inset-0 lg:h-full lg:w-full"
    >
      <video
        ref={leftRef}
        src={VIDEO_LEFT}
        muted
        playsInline
        preload="auto"
        onLoadedData={onLoaded}
        onError={onError}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ display: 'none' }}
      />
      <video
        ref={rightRef}
        src={VIDEO_RIGHT}
        muted
        playsInline
        preload="auto"
        onLoadedData={onLoaded}
        onError={onError}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ display: 'block' }}
      />
    </div>
  );
}
