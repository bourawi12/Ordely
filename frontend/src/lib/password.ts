/**
 * The password rule, for the live checklist and an early check in server actions. The API
 * enforces the same rule (backend/src/auth/password.ts): keep the two in step.
 */
export const PASSWORD_RULES = [
  {
    id: "length",
    test: (p: string) => p.length >= 8,
    en: "At least 8 characters",
    fr: "Au moins 8 caractères",
  },
  {
    id: "upper",
    test: (p: string) => /\p{Lu}/u.test(p),
    en: "An uppercase letter",
    fr: "Une majuscule",
  },
  {
    id: "lower",
    test: (p: string) => /\p{Ll}/u.test(p),
    en: "A lowercase letter",
    fr: "Une minuscule",
  },
  {
    id: "digit",
    test: (p: string) => /\p{Nd}/u.test(p),
    en: "A number",
    fr: "Un chiffre",
  },
  {
    id: "special",
    // Anything that is not a letter, a digit or a space.
    test: (p: string) => /[^\p{L}\p{N}\s]/u.test(p),
    en: "A special character (!, @, #…)",
    fr: "Un caractère spécial (!, @, #…)",
  },
] as const;

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
