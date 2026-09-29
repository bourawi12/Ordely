// Onboarding screens and the closed lists' options. Codes mirror
// backend/src/boutique/boutique-options.ts; labels are French like the auth pages.

export const STEPS = [
  { slug: "boutique", title: "Votre boutique", short: "Boutique", required: true },
  { slug: "agent", title: "Votre agent", short: "Agent", required: true },
  { slug: "details", title: "Votre activité", short: "Activité", required: false },
] as const;

export type StepNumber = 1 | 2 | 3;

export function stepHref(step: StepNumber): string {
  return `/onboarding/${STEPS[step - 1].slug}`;
}

export function stepFromSlug(slug: string): StepNumber | null {
  const index = STEPS.findIndex((s) => s.slug === slug);
  return index === -1 ? null : ((index + 1) as StepNumber);
}

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export const PLATFORMS: Option[] = [
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "social_shop", label: "Facebook / Instagram Shop" },
  { value: "custom", label: "Site sur mesure" },
  { value: "none", label: "Aucune", hint: "Je vends par messages" },
];

export const CALL_LANGUAGES: Option[] = [
  { value: "darija", label: "Darija" },
  { value: "french", label: "Français" },
  { value: "english", label: "Anglais" },
];

export const CONFIRMATION_PROCESSES: Option[] = [
  { value: "in_house_team", label: "Une équipe en interne" },
  { value: "external_provider", label: "Un prestataire externe" },
  { value: "myself", label: "Moi-même" },
  { value: "none", label: "Pas encore de process" },
];

export const SECTORS: Option[] = [
  { value: "fashion", label: "Mode" },
  { value: "cosmetics", label: "Cosmétique" },
  { value: "electronics", label: "Électronique" },
  { value: "food", label: "Alimentaire" },
  { value: "other", label: "Autre" },
];

export const ALL_ZONES = "all";

export const GOUVERNORATS: Option[] = [
  { value: "ariana", label: "Ariana" },
  { value: "beja", label: "Béja" },
  { value: "ben_arous", label: "Ben Arous" },
  { value: "bizerte", label: "Bizerte" },
  { value: "gabes", label: "Gabès" },
  { value: "gafsa", label: "Gafsa" },
  { value: "jendouba", label: "Jendouba" },
  { value: "kairouan", label: "Kairouan" },
  { value: "kasserine", label: "Kasserine" },
  { value: "kebili", label: "Kébili" },
  { value: "kef", label: "Le Kef" },
  { value: "mahdia", label: "Mahdia" },
  { value: "manouba", label: "La Manouba" },
  { value: "medenine", label: "Médenine" },
  { value: "monastir", label: "Monastir" },
  { value: "nabeul", label: "Nabeul" },
  { value: "sfax", label: "Sfax" },
  { value: "sidi_bouzid", label: "Sidi Bouzid" },
  { value: "siliana", label: "Siliana" },
  { value: "sousse", label: "Sousse" },
  { value: "tataouine", label: "Tataouine" },
  { value: "tozeur", label: "Tozeur" },
  { value: "tunis", label: "Tunis" },
  { value: "zaghouan", label: "Zaghouan" },
];

export const ORDER_VOLUMES: Option[] = [
  { value: "lt20", label: "Moins de 20 par jour" },
  { value: "20_50", label: "20 à 50 par jour" },
  { value: "50_100", label: "50 à 100 par jour" },
  { value: "100_300", label: "100 à 300 par jour" },
  { value: "gt300", label: "Plus de 300 par jour" },
];

export const ACQUISITION_SOURCES: Option[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Recherche Google" },
  { value: "referral", label: "Bouche-à-oreille" },
  { value: "event", label: "Événement" },
  { value: "other", label: "Autre" },
];

export const CARRIERS: Option[] = [
  { value: "aramex", label: "Aramex" },
  { value: "dhl", label: "DHL" },
  { value: "local", label: "Livreur local" },
  { value: "other", label: "Autre" },
];
