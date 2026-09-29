// Allowed values for the onboarding's closed lists. The frontend mirrors these codes
// (frontend/src/lib/onboarding.ts) with French labels.

export const PLATFORMS = [
  'shopify',
  'woocommerce',
  'social_shop',
  'custom',
  'none',
] as const;

export const CALL_LANGUAGES = ['darija', 'french', 'english'] as const;

export const CONFIRMATION_PROCESSES = [
  'in_house_team',
  'external_provider',
  'myself',
  'none',
] as const;

export const SECTORS = [
  'fashion',
  'cosmetics',
  'electronics',
  'food',
  'other',
] as const;

/** The 24 Tunisian gouvernorats; "all" means the whole country. */
export const GOUVERNORATS = [
  'ariana',
  'beja',
  'ben_arous',
  'bizerte',
  'gabes',
  'gafsa',
  'jendouba',
  'kairouan',
  'kasserine',
  'kebili',
  'kef',
  'mahdia',
  'manouba',
  'medenine',
  'monastir',
  'nabeul',
  'sfax',
  'sidi_bouzid',
  'siliana',
  'sousse',
  'tataouine',
  'tozeur',
  'tunis',
  'zaghouan',
] as const;
export const ALL_ZONES = 'all';

export const ORDER_VOLUMES = [
  'lt20',
  '20_50',
  '50_100',
  '100_300',
  'gt300',
] as const;

export const ACQUISITION_SOURCES = [
  'facebook',
  'instagram',
  'tiktok',
  'google',
  'referral',
  'event',
  'other',
] as const;

export const CARRIERS = ['aramex', 'dhl', 'local', 'other'] as const;

/** Minimum length of the daily calling window, in minutes. */
export const MIN_CALL_WINDOW_MINUTES = 60;
