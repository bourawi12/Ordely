/**
 * TEST MODE card handling for the simulated payment provider. Like a gateway's own checkout,
 * the card number is turned into a token here, in the browser: it is never sent to Ordely's
 * servers. Only these well-known test numbers are accepted, so nobody types a real card.
 */
export const TEST_CARDS = [
  {
    number: "4242424242424242",
    token: "tok_test_visa",
    label: "Paiement accepté (Visa)",
  },
  {
    number: "5555555555554444",
    token: "tok_test_mastercard",
    label: "Paiement accepté (Mastercard)",
  },
  {
    number: "4000000000000002",
    token: "tok_test_declined",
    label: "Carte refusée",
  },
  {
    number: "4000000000009995",
    token: "tok_test_insufficient_funds",
    label: "Solde insuffisant",
  },
] as const;

const digits = (value: string) => value.replace(/\D/g, "");

/** "4242424242424242" → "4242 4242 4242 4242" while typing. */
export function formatCardNumber(value: string): string {
  return digits(value)
    .slice(0, 16)
    .replace(/(.{4})(?=.)/g, "$1 ");
}

/** "1228" → "12/28" while typing. */
export function formatExpiry(value: string): string {
  const d = digits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export type CardError = "number" | "test_only" | "expiry" | "cvc" | "name";

/** The test token for a card, or what is wrong with what was typed. */
export function tokenizeTestCard(card: {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
}): { token: string } | { error: CardError } {
  const number = digits(card.number);
  if (number.length !== 16) return { error: "number" };
  const [mm, yy] = card.expiry.split("/").map(Number);
  const now = new Date();
  const expired =
    !mm ||
    mm > 12 ||
    Number.isNaN(yy) ||
    2000 + yy < now.getFullYear() ||
    (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
  if (card.expiry.length !== 5 || expired) return { error: "expiry" };
  if (!/^\d{3}$/.test(card.cvc)) return { error: "cvc" };
  if (!card.name.trim()) return { error: "name" };
  const known = TEST_CARDS.find((c) => c.number === number);
  return known ? { token: known.token } : { error: "test_only" };
}
