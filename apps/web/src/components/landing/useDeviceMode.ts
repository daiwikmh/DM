import { useEffect, useState } from 'react';

/**
 * Desktop here means "wide enough and has a real pointer" — a touch
 * laptop at 1400px still gets the touch experience, matching the spec's
 * split between cursor-scrubbed video (desktop) and autoplay (touch).
 */
function computeIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024 && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function useDeviceMode() {
  const [isDesktop, setIsDesktop] = useState(computeIsDesktop);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(computeIsDesktop());
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => setPrefersReducedMotion(motionQuery.matches);

    window.addEventListener('resize', onResize);
    motionQuery.addEventListener('change', onMotionChange);
    return () => {
      window.removeEventListener('resize', onResize);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return { isDesktop, prefersReducedMotion };
}
