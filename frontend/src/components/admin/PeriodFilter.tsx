"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import ui from "@/components/app/ui.module.css";
import { RANGES } from "@/lib/admin-filters";
import styles from "./admin.module.css";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" }); // YYYY-MM-DD

/** Global date range: 7 / 30 / 90 days or custom days. Kept in the URL. */
export default function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const range = params.get("range") ?? "30d";
  const [custom, setCustom] = useState(range === "custom");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? today());

  const go = (next: Record<string, string | null>) => {
    const qs = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) qs.set(k, v);
      else qs.delete(k);
    }
    startTransition(() => router.push(`${pathname}${qs.toString() ? `?${qs}` : ""}`));
  };

  return (
    <div className={styles.period} data-pending={pending || undefined}>
      <div className={styles.ranges} role="group" aria-label="Period">
        {RANGES.map((r) => {
          const active = r.value === "custom" ? custom : !custom && r.value === range;
          return (
            <button
              key={r.value}
              type="button"
              className={styles.range}
              aria-pressed={active}
              onClick={() => {
                if (r.value === "custom") return setCustom(true);
                setCustom(false);
                go({ range: r.value === "30d" ? null : r.value, from: null, to: null });
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <form
          className={styles.customRange}
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) go({ range: "custom", from, to });
          }}
        >
          <label>
            From
            <input
              type="date"
              className={ui.input}
              value={from}
              max={to || today()}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </label>
          <label>
            To
            <input
              type="date"
              className={ui.input}
              value={to}
              min={from || undefined}
              max={today()}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </label>
          <button type="submit" className={ui.btnSoft}>
            Apply
          </button>
        </form>
      )}
    </div>
  );
}
