/**
 * All landing-page copy and media in one place. Everything here is a
 * placeholder standing in for real brand assets — swap freely without
 * touching any animation/layout code.
 */

// No product name has been chosen yet for this app — placeholder wordmark.
export const BRAND_NAME = 'JUSTDM';

export const CAPTION =
  'You send us what catches your eye. We tell you where to buy it and what it costs.';

export const NAV_LABEL = 'HOW IT WORKS';
export const NAV_ACTION_LABEL = '[ DASHBOARD ]';

export const PRODUCT_LABEL_LINE_1 = 'REEL TO';
export const PRODUCT_LABEL_LINE_2 = '"PRODUCT"';
export const PRODUCT_HERO_STAT = 'FREE';

export const CTA_LABEL = 'start';
export const CTA_HREF = '/dashboard';

export const FOOTER_LEFT = `${BRAND_NAME} (R) 2026`;
export const FOOTER_RIGHT = 'PRIVACY POLICY';

// MDN-hosted CC0 clips — verified 2026-08-01 as actually reachable with a real
// video/mp4 response and an explicit CORS header. The previous googleapis.com
// bucket URLs here now 403 (XML error body), which silently broke the whole
// landing page: VideoBackground.tsx never fires `onLoadedData`, so the video
// layer's opacity never leaves 0 and the exclusion-blend text reads as flat
// black-on-white instead of the intended white-on-video look.
export const VIDEO_LEFT = '/video/runway.mp4';

// Lorem Picsum — deterministic ids so the same 10 images render every load.
const GALLERY_IDS = [1011, 1015, 1025, 1035, 1041, 1050, 1062, 1074, 1084, 1080];
export const GALLERY_IMAGES = GALLERY_IDS.map(
  (id) => `https://picsum.photos/id/${id}/900/1350`,
);
