import Link from "next/link";
import type { ReactNode } from "react";
import { formatNumber, formatPercent } from "@/lib/format";
import styles from "./admin.module.css";

/* Charts for the back office: plain SVG/CSS, server-rendered, with native tooltips (<title>,
   data-tip) and labels, so nothing relies on colour alone. */

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** Rounds a maximum up to a readable axis top (1, 2, 2.5, 5 × 10^n). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * exp >= v) ?? 10) * exp;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export interface Series {
  label: string;
  values: number[];
  /** a = first series colour, b = second. */
  tone?: "a" | "b";
}

/** Trend over days: one shared axis (series must share a unit). */
export function LineChart({
  dates,
  series,
  format = formatNumber,
  height = 220,
}: {
  dates: string[];
  series: Series[];
  format?: (v: number) => string;
  height?: number;
}) {
  if (dates.length === 0 || series.every((s) => s.values.every((v) => v === 0))) {
    return <Empty>No activity in this period.</Empty>;
  }
  const W = 1000;
  const top = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const x = (i: number) => (dates.length === 1 ? W / 2 : (i / (dates.length - 1)) * W);
  const y = (v: number) => height - (v / top) * height;
  const ticks = [0, Math.floor((dates.length - 1) / 2), dates.length - 1];
  return (
    <div className={styles.line}>
      {series.length > 1 && (
        <ul className={styles.legend}>
          {series.map((s) => (
            <li key={s.label}>
              <span className={styles.swatch} data-tone={s.tone ?? "a"} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.plot}>
        <div className={styles.yAxis} aria-hidden="true">
          <span>{format(top)}</span>
          <span>{format(top / 2)}</span>
          <span>0</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          style={{ height }}
          role="img"
          aria-label={series
            .map((s) => `${s.label}: ${format(s.values.reduce((a, b) => a + b, 0))} in total`)
            .join(", ")}
        >
          {[0.5, 1].map((f) => (
            <line key={f} x1="0" x2={W} y1={height * (1 - f)} y2={height * (1 - f)} className={styles.gridLine} />
          ))}
          {series.map((s) => (
            <polyline
              key={s.label}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              className={styles.path}
              data-tone={s.tone ?? "a"}
            />
          ))}
          {/* Hover targets wider than the line: one per day. */}
          {dates.map((d, i) => (
            <rect
              key={d}
              x={x(i) - W / dates.length / 2}
              width={W / dates.length}
              y="0"
              height={height}
              className={styles.hit}
            >
              <title>
                {`${shortDate(d)} — ${series.map((s) => `${s.label}: ${format(s.values[i])}`).join(" · ")}`}
              </title>
            </rect>
          ))}
        </svg>
      </div>
      <div className={styles.xAxis} aria-hidden="true">
        {ticks.map((i, k) => (
          <span key={`${i}-${k}`}>{shortDate(dates[i])}</span>
        ))}
      </div>
    </div>
  );
}

export interface BarRow {
  key: string | number;
  label: string;
  value: number;
  display: string;
  note?: string;
  href?: string;
}

/** Horizontal bars, scaled to the largest value: comparisons between items. */
export function Bars({ rows, empty = "Nothing to show yet." }: { rows: BarRow[]; empty?: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const peak = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <ul className={styles.bars}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className={styles.barLabel} title={r.label}>
            {r.href ? <Link href={r.href}>{r.label}</Link> : r.label}
          </span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${(r.value / peak) * 100}%` }} />
          </span>
          <span className={styles.barValue}>
            {r.display}
            {r.note && <small>{r.note}</small>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Activation funnel: each step's share of signups, and the drop from the step before. */
export function Funnel({
  steps,
}: {
  steps: { key: string; label: string; count: number; ofTotal: number; dropOff: number }[];
}) {
  if (!steps.length || steps[0].count === 0) {
    return <Empty>No signups in this period.</Empty>;
  }
  return (
    <ol className={styles.funnel}>
      {steps.map((s, i) => (
        <li key={s.key}>
          {i > 0 && (
            <span className={styles.drop} data-high={s.dropOff >= 0.5 || undefined}>
              {s.dropOff > 0 ? `−${formatPercent(s.dropOff)} drop-off` : "no drop-off"}
            </span>
          )}
          <div className={styles.funnelRow}>
            <span className={styles.funnelLabel}>{s.label}</span>
            <span className={styles.funnelTrack}>
              <span className={styles.funnelFill} style={{ width: `${Math.max(s.ofTotal * 100, 0.5)}%` }} />
            </span>
            <span className={styles.funnelValue}>
              {formatNumber(s.count)}
              <small>{formatPercent(s.ofTotal)}</small>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Below this many calls, a cell's rate is not shown as reliable. */
const MIN_CELL_CALLS = 10;

/** Confirmation rate by hour (columns) and weekday (rows), one hue from light to dark. */
export function Heatmap({
  cells,
}: {
  cells: { weekday: number; hour: number; calls: number; confirmed: number }[];
}) {
  const withCalls = cells.filter((c) => c.calls > 0);
  if (withCalls.length === 0) return <Empty>No calls in this period.</Empty>;
  const first = Math.min(8, ...withCalls.map((c) => c.hour));
  const last = Math.max(21, ...withCalls.map((c) => c.hour));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const find = (d: number, h: number) => cells.find((c) => c.weekday === d && c.hour === h);
  return (
    <div className={styles.heat}>
      <div
        className={styles.heatGrid}
        style={{ gridTemplateColumns: `2.5rem repeat(${hours.length}, minmax(0, 1fr))` }}
        role="table"
        aria-label="Confirmation rate by weekday and hour"
      >
        <span role="columnheader" />
        {hours.map((h) => (
          <span key={h} className={styles.heatHour} role="columnheader">
            {String(h).padStart(2, "0")}
          </span>
        ))}
        {WEEKDAYS.map((label, i) => (
          <div key={label} className={styles.heatRow} role="row">
            <span className={styles.heatDay} role="rowheader">
              {label}
            </span>
            {hours.map((h) => {
              const c = find(i + 1, h);
              const calls = c?.calls ?? 0;
              const r = calls ? c!.confirmed / calls : 0;
              const reliable = calls >= MIN_CELL_CALLS;
              return (
                <span
                  key={h}
                  role="cell"
                  className={styles.heatCell}
                  data-sparse={!reliable || undefined}
                  style={reliable ? { ["--level" as string]: `${Math.round(15 + r * 85)}%` } : undefined}
                  data-tip={`${label} ${String(h).padStart(2, "0")}:00 · ${
                    calls ? `${formatPercent(r)} confirmed · ${formatNumber(calls)} calls` : "no calls"
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.heatLegend} aria-hidden="true">
        <span>0%</span>
        <span className={styles.heatScale} />
        <span>100% confirmed</span>
        <span className={styles.heatSparse} /> fewer than {MIN_CELL_CALLS} calls
      </div>
    </div>
  );
}
