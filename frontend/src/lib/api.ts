import "server-only";
import { redirect } from "next/navigation";
import { getSessionToken } from "./session";
import type { ThemeMode } from "./theme";

export type OrderStatus = "pending" | "confirmed" | "cancelled";
export type CallStatus = "pending" | "confirmed" | "failed" | "no_answer";
export type CallRange = "today" | "7d" | "30d" | "all";

export interface Order {
  id: number;
  customer: string;
  phone: string;
  item: string;
  quantity: number;
  /** TND, serialized as a decimal string. */
  total: string;
  status: OrderStatus;
  createdAt: string;
}

export interface TranscriptLine {
  speaker: "agent" | "customer";
  text: string;
}

export interface Call {
  id: number;
  orderId: number;
  status: CallStatus;
  attempt: number;
  durationSeconds: number | null;
  language: string | null;
  transcript: TranscriptLine[] | null;
  recordingUrl: string | null;
  createdAt: string;
}

export type CallWithOrder = Call & {
  order: Pick<Order, "id" | "customer" | "phone" | "total">;
};

export interface CallsPage {
  items: CallWithOrder[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<CallStatus | "all", number>;
}

export interface CallFilters {
  status?: CallStatus;
  search?: string;
  range?: CallRange;
  page?: number;
}

export interface Metric {
  value: number;
  previous: number;
}

export interface DashboardSummary {
  stats: {
    totalOrders: Metric;
    confirmedOrders: Metric;
    failedCalls: Metric;
    avgDuration: Metric;
  };
  week: { date: string; confirmed: number }[];
  recentCalls: (Call & { order: Pick<Order, "id" | "customer"> })[];
  pendingOrders: (Order & { callQueued: boolean })[];
  pendingCount: number;
}

export type AnalyticsRange = "7d" | "30d" | "90d";

export interface Analytics {
  range: AnalyticsRange;
  from: string;
  to: string;
  kpis: {
    orders: Metric;
    /** 0–1: confirmed orders / orders placed. */
    confirmationRate: Metric;
    confirmedRevenue: Metric;
    cancelledValue: Metric;
    /** 0–1: answered calls / finished calls. */
    answerRate: Metric;
    avgAttempts: Metric;
    avgMinutesToConfirm: Metric;
    avgOrderValue: Metric;
  };
  outcomes: { confirmed: number; cancelled: number; pending: number };
  callOutcomes: Record<CallStatus, number>;
  daily: { date: string; confirmed: number; cancelled: number; pending: number }[];
  byHour: { hour: number; calls: number; answered: number; confirmed: number }[];
  /** 1 = Monday … 7 = Sunday. */
  byWeekday: { weekday: number; orders: number; confirmed: number }[];
  byProduct: { item: string; orders: number; confirmed: number; cancelled: number; revenue: number }[];
  byLanguage: { language: string; calls: number; confirmed: number; avgDuration: number }[];
  byAttempt: { attempt: number; calls: number; confirmed: number }[];
}

export interface Usage {
  plan: string;
  used: number;
  limit: number;
}

export interface Health {
  status: string;
  database?: string;
  timestamp: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  /** Signed, short-lived URL of the profile picture (stored in MinIO), or null. */
  avatarUrl: string | null;
  /** "#rrggbb", or null for the Ordely blue. */
  accentColor: string | null;
  themeMode: ThemeMode;
  /** Null until the address is confirmed through the emailed link; the app stays closed until then. */
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface Boutique {
  id: number;
  name: string | null;
  businessPhone: string | null;
  platform: string | null;
  callLanguages: string[];
  callStartTime: string | null;
  callEndTime: string | null;
  confirmationProcess: string | null;
  sector: string | null;
  deliveryZones: string[];
  dailyOrderVolume: string | null;
  acquisitionSource: string | null;
  carrier: string | null;
  onboardingCompletedAt: string | null;
  onboarding: { completed: boolean; nextStep: 1 | 2 | 3 };
}

export type BoutiqueSection = "identity" | "agent" | "details";

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001/api";
/** The API's 403 message for a signed-in account whose email is not confirmed yet
 * (backend/src/auth/allow-unverified.decorator.ts). */
const EMAIL_NOT_VERIFIED = "Email address not verified";

async function send(
  path: string,
  init: RequestInit | undefined,
  auth: boolean,
  explicitToken?: string,
): Promise<Response> {
  const token = explicitToken ?? (auth ? await getSessionToken() : undefined);
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      // FormData sets its own multipart Content-Type (with the boundary).
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  // Missing or expired session on a protected call: send the user to log in.
  if (res.status === 401 && auth) {
    redirect("/login?expired=1");
  }

  // Signed in but not confirmed yet: every page and action lands on the "check your inbox" screen.
  if (res.status === 403 && auth) {
    const body = await res.clone().json().catch(() => null);
    if (body?.message === EMAIL_NOT_VERIFIED) {
      redirect("/verify-email");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // Nest returns validation errors as an array of messages.
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? res.statusText);
    throw new ApiError(res.status, message);
  }

  return res;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  // `token` stands in for the session cookie, e.g. right after sign-up in the same request.
  { auth = true, token }: { auth?: boolean; token?: string } = {},
): Promise<T> {
  const res = await send(path, init, auth, token);
  return res.status === 204 ? (undefined as T) : res.json();
}

function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export const api = {
  health: () => request<Health>("/health", undefined, { auth: false }),
  login: (data: { email: string; password: string }) =>
    request<AuthResult>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(data) },
      { auth: false },
    ),
  register: (data: {
    email: string;
    name: string;
    password: string;
    accentColor?: string;
    themeMode?: ThemeMode;
  }) =>
    request<AuthResult>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) },
      { auth: false },
    ),
  me: () => request<User>("/auth/me"),
  /** Public: the emailed link may be opened without a session. */
  forgotPassword: (email: string) =>
    request<{ sent: true }>(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      { auth: false },
    ),
  resetPassword: (data: { token: string; password: string }) =>
    request<AuthResult>(
      "/auth/reset-password",
      { method: "POST", body: JSON.stringify(data) },
      { auth: false },
    ),
  verifyEmail: (token: string) =>
    request<{ email: string }>(
      "/auth/verify-email",
      { method: "POST", body: JSON.stringify({ token }) },
      { auth: false },
    ),
  resendVerification: () =>
    request<{ sent: true }>("/auth/resend-verification", { method: "POST" }),

  /** multipart body with the image in the "file" field. */
  uploadAvatar: (form: FormData, token?: string) =>
    request<User>("/auth/avatar", { method: "POST", body: form }, { token }),
  removeAvatar: () => request<User>("/auth/avatar", { method: "DELETE" }),
  /** accentColor null goes back to the Ordely blue. */
  updateAppearance: (data: { accentColor: string | null; themeMode: ThemeMode }) =>
    request<User>("/auth/appearance", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
updateProfile: (data: { name: string }) =>
  request<User>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  }),

changePassword: (data: {
  currentPassword: string;
  newPassword: string;
}) =>
  request<{ success: boolean }>("/auth/change-password", {
    method: "PATCH",
    body: JSON.stringify(data),
  }),

boutique: () => request<Boutique>("/boutique"),

updateBoutique: (
  section: BoutiqueSection,
  data: Record<string, unknown>,
) =>
  request<Boutique>(`/boutique/${section}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),

completeOnboarding: () =>
  request<Boutique>("/boutique/onboarding/complete", {
    method: "POST",
  }),
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  analytics: (range: AnalyticsRange) => request<Analytics>(`/analytics?range=${range}`),
  usage: () => request<Usage>("/calls/usage"),
  listCalls: (filters: CallFilters) =>
    request<CallsPage>(`/calls${query({ ...filters })}`),
  getCall: (id: number) =>
    request<CallWithOrder & { attempts: number }>(`/calls/${id}`),
  exportCalls: async (filters: Omit<CallFilters, "page">) =>
    (await send(`/calls/export${query({ ...filters })}`, undefined, true)).text(),
  queueCall: (orderId: number) =>
    request<Call>("/calls", { method: "POST", body: JSON.stringify({ orderId }) }),
  queueAllPending: () =>
    request<{ queued: number }>("/calls/queue-pending", { method: "POST" }),
  /** Upload a CSV file to bulk-import orders. */
  importOrders: (form: FormData) =>
    request<ImportResult>("/orders/import", { method: "POST", body: form }),
  listOrders: (status?: OrderStatus) =>
    request<Order[]>(`/orders${status ? `?status=${status}` : ""}`),
  getOrder: (id: number) =>
    request<Order & { calls: Call[] }>(`/orders/${id}`),
  createOrder: (
    data: Pick<Order, "customer" | "phone" | "item" | "quantity"> & { total: number },
  ) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
  updateOrder: (
    id: number,
    data: Partial<
      Pick<Order, "status" | "customer" | "phone" | "item" | "quantity"> & { total: number }
    >,
  ) =>
    request<Order>(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOrder: (id: number) =>
    request<void>(`/orders/${id}`, { method: "DELETE" }),
};

