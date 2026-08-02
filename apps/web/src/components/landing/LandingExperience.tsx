import { useCallback, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { CustomCursor } from './CustomCursor.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import { Gallery, type GalleryHandle } from './Gallery.tsx';
import { HeroOverlay, type HeroOverlayHandle } from './HeroOverlay.tsx';
import { useDeviceMode } from './useDeviceMode.ts';

gsap.registerPlugin(ScrollTrigger);

/**
 * Owns the scroll choreography. The panel's entrance slide is the one piece
 * driven by GSAP ScrollTrigger (as spec'd: scrub, ease: none, over the first
 * 100vh). Everything after that — card scaling, the phase-2 wrapper
 * translate, and the outro sequence — is plain RAF math against
 * window.scrollY, also as spec'd ("RAF-based, NOT scroll events"). Both the
 * GSAP tween and the RAF loop compute the panel's offset with the same
 * `vh - scrollY` formula independently; they don't need to talk to each
 * other because that quantity is a pure function of scroll position.
 */
export function LandingExperience() {
  const spacerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<GalleryHandle>(null);
  const heroRef = useRef<HeroOverlayHandle>(null);
  const maxScrollRef = useRef(0);
  const { isDesktop } = useDeviceMode();

  const applySpacerHeight = useCallback(() => {
    const vh = window.innerHeight;
    if (spacerRef.current) {
      spacerRef.current.style.height = `${vh + maxScrollRef.current + vh}px`;
    }
    ScrollTrigger.refresh();
  }, []);

  const onWrapperHeightChange = useCallback(
    (wrapperScrollHeight: number) => {
      maxScrollRef.current = Math.max(0, wrapperScrollHeight - window.innerHeight);
      applySpacerHeight();
    },
    [applySpacerHeight],
  );

  useGSAP(() => {
    if (!panelRef.current) return;

    gsap.set(panelRef.current, { yPercent: 100 });
    gsap.to(panelRef.current, {
      yPercent: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: spacerRef.current ?? document.documentElement,
        start: 'top top',
        end: () => `+=${window.innerHeight}`,
        scrub: true,
      },
    });

    window.addEventListener('resize', applySpacerHeight);
    return () => window.removeEventListener('resize', applySpacerHeight);
  }, [applySpacerHeight]);

  useGSAP(() => {
    let raf = requestAnimationFrame(function tick() {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      const maxScroll = maxScrollRef.current;

      const panelOffset = Math.max(0, vh - scrollY); // matches the GSAP tween's own math
      const wrapperOffset = scrollY <= vh ? 0 : -Math.min(scrollY - vh, maxScroll);
      const effectiveOffset = panelOffset + wrapperOffset;

      galleryRef.current?.setWrapperOffset(wrapperOffset);
      galleryRef.current?.updateCards(effectiveOffset, vh);

      const outroStart = vh + maxScroll;
      const outroProgress = scrollY <= outroStart ? 0 : (scrollY - outroStart) / Math.max(1, vh - 100);
      heroRef.current?.setOutroProgress(outroProgress);

      if (layersRef.current) {
        const spent = outroProgress >= 1;
        layersRef.current.style.opacity = spent ? '0' : '1';
        layersRef.current.style.pointerEvents = spent ? 'none' : '';
      }

      raf = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      id="scroll-spacer"
      ref={spacerRef}
      className={`relative bg-white select-none ${isDesktop ? 'cursor-none' : ''}`}
      style={{ height: '500vh', fontFamily: "'Inter Tight', sans-serif" }}
    >
      <div ref={layersRef} className="transition-opacity duration-300">
        {isDesktop && <CustomCursor />}
        <VideoBackground />

        <div ref={panelRef} className="fixed inset-0 z-10 bg-black">
          <Gallery ref={galleryRef} onWrapperHeightChange={onWrapperHeightChange} />
        </div>

        <HeroOverlay ref={heroRef} />
      </div>
    </div>
  );
}
