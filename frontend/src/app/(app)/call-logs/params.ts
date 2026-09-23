import type { CallFilters, CallRange, CallStatus } from "@/lib/api";

export const STATUS_TABS: { value?: CallStatus; label: string; key: CallStatus | "all" }[] = [
  { key: "all", label: "All" },
  { value: "confirmed", key: "confirmed", label: "Confirmed" },
  { value: "failed", key: "failed", label: "Failed" },
  { value: "no_answer", key: "no_answer", label: "No Answer" },
  { value: "pending", key: "pending", label: "Pending" },
];

export const RANGES: { value: CallRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const STATUSES = new Set(["pending", "confirmed", "failed", "no_answer"]);
const RANGE_VALUES = new Set(RANGES.map((r) => r.value));

export interface CallLogParams extends Required<Pick<CallFilters, "range" | "page">> {
  status?: CallStatus;
  search?: string;
  call?: number;
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseParams(raw: Raw): CallLogParams {
  const status = one(raw.status);
  const range = one(raw.range);
  const page = Number(one(raw.page));
  const call = Number(one(raw.call));
  const search = one(raw.search)?.trim().slice(0, 100);
  return {
    status: status && STATUSES.has(status) ? (status as CallStatus) : undefined,
    range: range && RANGE_VALUES.has(range as CallRange) ? (range as CallRange) : "today",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    search: search || undefined,
    call: Number.isInteger(call) && call > 0 ? call : undefined,
  };
}

/** Builds a /call-logs URL from the current params plus overrides. */
export function callLogsHref(params: CallLogParams, overrides: Partial<CallLogParams> = {}) {
  const next = { ...params, ...overrides };
  const qs = new URLSearchParams();
  if (next.status) qs.set("status", next.status);
  if (next.search) qs.set("search", next.search);
  if (next.range !== "today") qs.set("range", next.range);
  if (next.page > 1) qs.set("page", String(next.page));
  if (next.call) qs.set("call", String(next.call));
  const s = qs.toString();
  return s ? `/call-logs?${s}` : "/call-logs";
}
