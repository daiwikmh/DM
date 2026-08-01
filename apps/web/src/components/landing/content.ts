/**
 * All landing-page copy and media in one place. Everything here is a
 * placeholder standing in for real brand assets — swap freely without
 * touching any animation/layout code.
 */

// No product name has been chosen yet for this app — placeholder wordmark.
export const BRAND_NAME = 'FOUND';

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

// Google-hosted Blender Foundation demo clips — stable, permissively served,
// reliable placeholders for the two scrub-driven hero videos.
export const VIDEO_LEFT =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
export const VIDEO_RIGHT =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

// Lorem Picsum — deterministic ids so the same 10 images render every load.
const GALLERY_IDS = [1011, 1015, 1025, 1035, 1041, 1050, 1062, 1074, 1084, 1080];
export const GALLERY_IMAGES = GALLERY_IDS.map(
  (id) => `https://picsum.photos/id/${id}/900/1350`,
);
