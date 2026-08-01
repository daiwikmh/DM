import { useEffect, useRef, useState } from 'react';
import { VIDEO_LEFT } from './content.ts';

export function VideoBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded && containerRef.current) containerRef.current.style.opacity = '1';
  }, [loaded]);

  const onLoaded = () => setLoaded(true);

  // A dead video URL (as happened 2026-08-01 — the prior placeholders started
  // 403ing) must not leave the container permanently invisible; treat an
  // error as settled so the overlay still reveals rather than hanging at
  // opacity-0.
  const onError = () => setLoaded(true);

  return (
    <div
      id="main-canvas"
      ref={containerRef}
      className="pointer-events-none fixed top-[220px] left-0 z-0 h-[calc(100vh-220px)] w-screen overflow-hidden bg-black opacity-0 transition-opacity duration-300 lg:inset-0 lg:h-full lg:w-full"
    >
      <video
        ref={videoRef}
        src={VIDEO_LEFT}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedData={onLoaded}
        onError={onError}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
