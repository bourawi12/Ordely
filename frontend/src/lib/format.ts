// Display helpers. Times are shown in Tunisia's timezone regardless of server locale.
export const TIMEZONE = "Africa/Tunis";

const tnd = new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 });

export function formatTND(value: string | number): string {
  return `${tnd.format(Number(value))} TND`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  });
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest && hours < 3 ? `${hours}h ${rest}min ago` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Short weekday label ("Mon") for a YYYY-MM-DD date. */
export function weekdayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export interface Change {
  text: string;
  good: boolean | null;
}

/** "+12% vs last 30 days"; `lowerIsBetter` flips which direction is green. */
export function percentChange(
  value: number,
  previous: number,
  lowerIsBetter = false,
  period = "last 30 days",
): Change {
  if (previous === 0) return { text: value ? "New this period" : "No change", good: null };
  const pct = Math.round(((value - previous) / previous) * 100);
  return {
    text: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}% vs ${period}`,
    good: pct === 0 ? null : lowerIsBetter ? pct < 0 : pct > 0,
  };
}

export function secondsChange(value: number, previous: number): Change {
  const diff = value - previous;
  return {
    text: `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${Math.abs(diff)}s vs last 30 days`,
    good: diff === 0 ? null : diff < 0,
  };
}

/** "+3.2 pts vs previous 30 days" for two 0–1 rates. */
export function pointsChange(value: number, previous: number, period: string): Change {
  const pts = Math.round((value - previous) * 1000) / 10;
  return {
    text: `${pts > 0 ? "+" : pts < 0 ? "−" : ""}${Math.abs(pts)} pts vs ${period}`,
    good: pts === 0 ? null : pts > 0,
  };
}

/** A 0–1 rate as "81%" (one decimal under 10%). */
export function formatPercent(rate: number): string {
  const pct = rate * 100;
  return `${pct > 0 && pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
