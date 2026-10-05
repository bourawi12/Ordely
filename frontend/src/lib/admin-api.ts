import "server-only";
import { request, send } from "./api";

/**
 * The internal back office API (/api/admin/*): Ordely team only, enforced by the backend
 * (403 for merchants). Aggregates and merchant account info, never end customers' data.
 */

export type PeriodRange = "7d" | "30d" | "90d" | "custom";
export type MerchantStatus = "active" | "new" | "dormant" | "churned";

export interface PeriodQuery {
  range?: PeriodRange;
  from?: string;
  to?: string;
}

export interface Period {
  range: PeriodRange;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  days: number;
}

export interface Metric {
  value: number;
  previous: number;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  ofTotal: number;
  dropOff: number;
}

export interface PlanMix {
  plan: string;
  label: string;
  price: number;
  merchants: Metric;
  mrr: Metric;
}

export interface Overview {
  period: Period;
  kpis: {
    totalMerchants: Metric;
    newSignups: Metric;
    activatedMerchants: Metric;
    activeMerchants: Metric;
    paidMerchants: Metric;
    freeMerchants: Metric;
    mrr: Metric;
    churnedMerchants: Metric;
  };
  plans: PlanMix[];
  funnel: FunnelStep[];
}

interface Brief {
  id: number;
  name: string;
  plan: string;
}

export interface Usage {
  period: Period;
  totals: {
    calls: Metric;
    orders: Metric;
    avgCallsPerMerchant: Metric;
    avgQuotaUsed: number;
  };
  daily: { date: string; calls: number; orders: number; activeMerchants: number }[];
  upsell: (Brief & { used: number; quota: number; share: number })[];
  dormant: (Brief & { lastActivityAt: string; daysIdle: number; callsTotal: number })[];
  dormantDays: number;
  top: (Brief & { calls: number; orders: number })[];
}

export interface Quality {
  period: Period;
  totals: {
    calls: Metric;
    confirmationRate: Metric;
    cancellationRate: Metric;
    noAnswerRate: Metric;
    avgDuration: Metric;
    avgAttempts: Metric;
  };
  heatmap: { weekday: number; hour: number; calls: number; confirmed: number }[];
  byLanguage: { language: string; calls: number; confirmed: number; avgDuration: number }[];
  bySector: { sector: string; calls: number; confirmed: number; refused: number }[];
  byMerchant: {
    id: number;
    name: string;
    calls: number;
    confirmationRate: number;
    cancellationRate: number;
    noAnswerRate: number;
    avgDuration: number;
  }[];
}

export interface Revenue {
  period: Period;
  costs: { perMinute: number; perCall: number; currency: string };
  totals: {
    revenue: Metric;
    cost: Metric;
    grossMargin: Metric;
    marginRate: Metric;
    revenuePerCall: Metric;
    costPerCall: Metric;
    mrr: Metric;
  };
  byPlan: {
    plan: string;
    label: string;
    price: number;
    merchants: number;
    mrr: number;
    revenue: number;
    cost: number;
    margin: number;
  }[];
  byMerchant: (Brief & {
    calls: number;
    minutes: number;
    revenue: number;
    cost: number;
    margin: number;
  })[];
}

export interface MerchantRow {
  id: number;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  signupAt: string;
  plan: string;
  paidPlan: string | null;
  planStartedAt: string | null;
  churnedAt: string | null;
  onboarded: boolean;
  sector: string | null;
  orders: number;
  ordersTotal: number;
  calls: number;
  confirmed: number;
  refused: number;
  noAnswer: number;
  seconds: number;
  monthCalls: number;
  quota: number;
  quotaUsed: number;
  callsTotal: number;
  lastActivityAt: string | null;
  confirmationRate: number | null;
  revenue: number;
  cost: number;
  margin: number;
  health: number;
  status: MerchantStatus;
}

export interface MerchantsQuery extends PeriodQuery {
  search?: string;
  plan?: string;
  status?: MerchantStatus;
  sort?: string;
  dir?: "asc" | "desc";
}

export interface MerchantDetail {
  period: Period;
  merchant: MerchantRow;
  shop: {
    platform: string | null;
    callLanguages: string[];
    callStartTime: string | null;
    callEndTime: string | null;
    confirmationProcess: string | null;
    deliveryZones: string[];
    dailyOrderVolume: string | null;
    acquisitionSource: string | null;
    carrier: string | null;
    onboardingCompletedAt: string | null;
  } | null;
  daily: { date: string; orders: number; calls: number; confirmed: number }[];
}

export interface Cohorts {
  weeks: number;
  cohorts: {
    week: string;
    size: number;
    retention: { week1: number | null; week2: number | null; week4: number | null; week8: number | null };
  }[];
}

export const EXPORT_DATASETS = ["merchants", "overview", "usage", "quality", "revenue", "cohorts"] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

/** Query string for the backend from the page's filters (empty values left out). */
export function qs(params: object): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") out.set(key, String(value));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export const adminApi = {
  overview: (q: PeriodQuery) => request<Overview>(`/admin/overview${qs(q)}`),
  usage: (q: PeriodQuery) => request<Usage>(`/admin/usage${qs(q)}`),
  quality: (q: PeriodQuery) => request<Quality>(`/admin/quality${qs(q)}`),
  revenue: (q: PeriodQuery) => request<Revenue>(`/admin/revenue${qs(q)}`),
  merchants: (q: MerchantsQuery) =>
    request<{ period: Period; total: number; rows: MerchantRow[] }>(`/admin/merchants${qs(q)}`),
  merchant: (id: number, q: PeriodQuery) =>
    request<MerchantDetail>(`/admin/merchants/${id}${qs(q)}`),
  cohorts: (weeks?: number) => request<Cohorts>(`/admin/cohorts${qs({ weeks })}`),
  exportCsv: async (dataset: ExportDataset, search: string) =>
    (await send(`/admin/export/${dataset}${search}`, undefined, true)).text(),
};
