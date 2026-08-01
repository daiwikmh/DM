import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { motion } from 'motion/react';
import {
  BRAND_NAME,
  CAPTION,
  CTA_HREF,
  CTA_LABEL,
  FOOTER_LEFT,
  FOOTER_RIGHT,
  NAV_ACTION_LABEL,
  NAV_LABEL,
  PRODUCT_HERO_STAT,
  PRODUCT_LABEL_LINE_1,
  PRODUCT_LABEL_LINE_2,
} from './content.ts';

const EASE = [0.25, 0.1, 0.25, 1] as const;
const CIRCLE_SYMBOLS = ['8', '$', '^^', '%', '/'];

export interface HeroOverlayHandle {
  /** progress is 0..1 across the outro scroll range. */
  setOutroProgress(progress: number): void;
}

/**
 * Every fixed-position overlay piece from the spec (logo, caption, nav,
 * product info, view CTA, footer, white overlay) in one component — they're
 * all small, driven by the same parent RAF loop, and none is reused
 * elsewhere, so splitting each into its own file would just be indirection.
 */
export const HeroOverlay = forwardRef<HeroOverlayHandle>((_props, ref) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const circleSymbolRef = useRef<HTMLSpanElement>(null);
  const outroOffsetRef = useRef(166);

  useEffect(() => {
    const updateOffset = () => {
      outroOffsetRef.current = window.innerWidth < 1024 ? 132 : 166;
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  useEffect(() => {
    let lastUpdate = 0;
    const onScroll = () => {
      const now = performance.now();
      if (now - lastUpdate < 80) return;
      lastUpdate = now;
      if (circleSymbolRef.current) {
        const symbol = CIRCLE_SYMBOLS[Math.floor(Math.random() * CIRCLE_SYMBOLS.length)];
        circleSymbolRef.current.textContent = symbol;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useImperativeHandle(ref, () => ({
    setOutroProgress(progress: number) {
      const p = Math.min(1, Math.max(0, progress));
      if (overlayRef.current) overlayRef.current.style.opacity = String(p);
      if (footerRef.current) footerRef.current.style.opacity = String(p);
      if (infoRef.current) {
        infoRef.current.style.transform = `translateY(${-(p * outroOffsetRef.current)}px)`;
      }
      if (buttonRef.current) buttonRef.current.style.transform = `scale(${p})`;
    },
  }));

  return (
    <>
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0 }}
        className="pointer-events-none fixed top-4 left-4 z-20 w-[124px] sm:top-8 sm:left-8 sm:w-[266px] lg:w-[355px]"
        style={{ mixBlendMode: 'exclusion' }}
      >
        <svg viewBox="0 0 355 110" className="w-full">
          <text x="0" y="75" fill="white" fontSize="72" fontWeight="500" letterSpacing="-2">
            {BRAND_NAME}
          </text>
        </svg>
      </motion.div>

      {/* Header nav */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
        className="pointer-events-none fixed top-4 right-4 z-20 flex h-[30px] w-auto items-center justify-between sm:top-8 sm:right-8 sm:w-[330px]"
        style={{ mixBlendMode: 'exclusion' }}
      >
        <span className="hidden text-[15px] font-medium tracking-tight text-white uppercase sm:inline">
          {NAV_LABEL}
        </span>
        <div className="flex items-center gap-5 sm:gap-[50px]">
          <svg width="24" height="24" viewBox="0 0 40 40" className="sm:h-[30px] sm:w-[30px]">
            <path d="M0 14H40" stroke="white" strokeWidth="2.5" />
            <path d="M0 26H40" stroke="white" strokeWidth="2.5" />
          </svg>
          <span className="text-[13px] font-medium text-white sm:text-[15px]">{NAV_ACTION_LABEL}</span>
        </div>
      </motion.div>

      {/* Caption */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
        className="pointer-events-none fixed left-4 z-20 w-[calc(100vw-32px)] top-[118px] sm:top-[180px] sm:w-[calc(50vw-48px)] lg:top-[244px] lg:left-8 lg:w-[692px]"
        style={{ mixBlendMode: 'exclusion' }}
      >
        <p className="text-[12px] leading-[140%] font-medium tracking-[-0.04em] text-white">{CAPTION}</p>
      </motion.div>

      {/* Product info */}
      <motion.div
        ref={infoRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
        className="pointer-events-none fixed right-0 bottom-12 left-0 z-20 flex flex-col items-center sm:right-8 sm:bottom-20 sm:left-auto sm:w-[330px]"
        style={{ mixBlendMode: 'exclusion' }}
      >
        <div className="mb-3 flex w-[252px] flex-col items-start sm:mb-8 sm:w-full">
          <div className="relative mb-2 h-5 w-5 sm:h-[30px] sm:w-[30px]">
            <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full">
              <circle cx="20" cy="20" r="18.75" stroke="white" strokeWidth="2" fill="none" />
            </svg>
            <span
              ref={circleSymbolRef}
              className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tracking-[-0.04em] text-white uppercase sm:text-[15px]"
            >
              8
            </span>
          </div>
          <p className="w-full text-center text-[20px] leading-none font-medium tracking-[-0.04em] text-white uppercase sm:text-[30px]">
            {PRODUCT_LABEL_LINE_1}
            <br />
            {PRODUCT_LABEL_LINE_2}
          </p>
        </div>
        <p className="text-center text-[60px] leading-none font-medium tracking-[-0.04em] text-white sm:text-[80px]">
          {PRODUCT_HERO_STAT}
        </p>
      </motion.div>

      {/* View / CTA button — the one interactive element in this overlay layer */}
      <a
        ref={buttonRef}
        href={CTA_HREF}
        className="pointer-events-auto fixed right-4 bottom-[60px] left-4 z-20 flex h-[100px] scale-0 items-center justify-center rounded-[1335px] bg-white sm:right-8 sm:bottom-8 sm:left-auto sm:h-[174px] sm:w-[330px]"
        style={{ transformOrigin: 'right bottom' }}
      >
        <span className="text-[72px] font-medium tracking-[-0.04em] text-white sm:text-[110px]" style={{ mixBlendMode: 'exclusion' }}>
          {CTA_LABEL}
        </span>
      </a>

      {/* White overlay */}
      <div
        ref={overlayRef}
        className="pointer-events-none fixed inset-0 z-[12] bg-white opacity-0"
      />

      {/* Footer */}
      <div
        ref={footerRef}
        className="pointer-events-none fixed bottom-6 left-4 z-20 flex justify-between gap-0 opacity-0 sm:bottom-8 sm:gap-20"
        style={{ mixBlendMode: 'exclusion' }}
      >
        <span className="text-[11px] font-medium tracking-[-0.02em] text-white uppercase sm:text-[13px]">
          {FOOTER_LEFT}
        </span>
        <span className="text-[11px] font-medium tracking-[-0.02em] text-white uppercase sm:text-[13px]">
          {FOOTER_RIGHT}
        </span>
      </div>
    </>
  );
});

HeroOverlay.displayName = 'HeroOverlay';
