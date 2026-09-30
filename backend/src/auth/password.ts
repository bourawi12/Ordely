/**
 * Password strength, checked wherever a password is chosen (sign-up, password change) — never at
 * login, so accounts created before this rule can still sign in. Length (8–72) is checked apart.
 * Letters are Unicode-aware; a "special character" is anything that is not a letter, a digit or
 * a space. Mirrored in frontend/src/lib/password.ts for the live checklist.
 */
export const PASSWORD_RULE =
  /^(?=[\s\S]*\p{Lu})(?=[\s\S]*\p{Ll})(?=[\s\S]*\p{Nd})(?=[\s\S]*[^\p{L}\p{N}\s])/u;

export const PASSWORD_RULE_MESSAGE =
  '$property must contain an uppercase letter, a lowercase letter, a number and a special character';
