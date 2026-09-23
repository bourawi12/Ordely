import "server-only";
import { redirect } from "next/navigation";
import { getSessionToken } from "./session";

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
  createdAt: string;
}

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

async function send(
  path: string,
  init: RequestInit | undefined,
  auth: boolean,
): Promise<Response> {
  const token = auth ? await getSessionToken() : undefined;
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  // Missing or expired session on a protected call: send the user to log in.
  if (res.status === 401 && auth) {
    redirect("/login?expired=1");
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
  { auth = true }: { auth?: boolean } = {},
): Promise<T> {
  const res = await send(path, init, auth);
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

export const api = {
  health: () => request<Health>("/health", undefined, { auth: false }),
  login: (data: { email: string; password: string }) =>
    request<AuthResult>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(data) },
      { auth: false },
    ),
  register: (data: { email: string; name: string; password: string }) =>
    request<AuthResult>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) },
      { auth: false },
    ),
  me: () => request<User>("/auth/me"),
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
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
  listOrders: () => request<Order[]>("/orders"),
  getOrder: (id: number) =>
    request<Order & { calls: Call[] }>(`/orders/${id}`),
  createOrder: (
    data: Pick<Order, "customer" | "phone" | "item" | "quantity"> & { total: number },
  ) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
  updateOrder: (id: number, data: { status: OrderStatus }) =>
    request<Order>(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOrder: (id: number) =>
    request<void>(`/orders/${id}`, { method: "DELETE" }),
};
