import type { MerchantStatus, PeriodQuery, PeriodRange } from "./admin-api";

/** The back office's global filter lives in the URL: ?range=7d|30d|90d|custom&from&to. */

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const RANGES: { value: PeriodRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

export function parsePeriod(raw: Raw): PeriodQuery {
  const range = one(raw.range);
  const from = one(raw.from);
  const to = one(raw.to);
  if (range === "custom" && from && to && DAY.test(from) && DAY.test(to)) {
    return { range: "custom", from, to };
  }
  return { range: range === "7d" || range === "90d" ? range : "30d" };
}

/** "?range=…" to carry the period from page to page. */
export function periodSearch(p: PeriodQuery): string {
  if (p.range === "custom") return `?range=custom&from=${p.from}&to=${p.to}`;
  return p.range && p.range !== "30d" ? `?range=${p.range}` : "";
}

export function periodLabel(p: PeriodQuery): string {
  if (p.range === "custom") return `${p.from} → ${p.to}`;
  return `last ${p.range === "7d" ? "7" : p.range === "90d" ? "90" : "30"} days`;
}

export const STATUSES: MerchantStatus[] = ["active", "new", "dormant", "churned"];

export function parseMerchantFilters(raw: Raw) {
  const status = one(raw.status);
  const dir = one(raw.dir);
  return {
    search: one(raw.search)?.trim().slice(0, 100) || undefined,
    plan: one(raw.plan) || undefined,
    status: STATUSES.includes(status as MerchantStatus) ? (status as MerchantStatus) : undefined,
    sort: one(raw.sort) || undefined,
    dir: dir === "asc" || dir === "desc" ? dir : undefined,
  } as const;
}
