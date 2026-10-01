import type { Metadata } from "next";
import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { api, type Analytics, type AnalyticsRange } from "@/lib/api";
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatTND,
  percentChange,
  pointsChange,
  type Change,
} from "@/lib/format";
import styles from "./analytics.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics — Ordely" };

const RANGES: { value: AnalyticsRange; label: string; period: string }[] = [
  { value: "7d", label: "Last 7 days", period: "previous 7 days" },
  { value: "30d", label: "Last 30 days", period: "previous 30 days" },
  { value: "90d", label: "Last 90 days", period: "previous 90 days" },
];

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  return `${h}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function Kpi({
  label,
  value,
  change,
  hint,
}: {
  label: string;
  value: string;
  change: Change;
  hint: string;
}) {
  const tone =
    change.good === null ? styles.flat : change.good ? styles.up : styles.down;
  return (
    <div className={`${ui.card} ${styles.kpi}`}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={`${styles.change} ${tone}`}>{change.text}</p>
      <p className={styles.kpiHint}>{hint}</p>
    </div>
  );
}

function Card({
  title,
  insight,
  children,
  wide,
}: {
  title: string;
  insight?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`${ui.card} ${ui.cardPad} ${wide ? styles.wide : ""}`}>
      <div className={styles.cardHead}>
        <h2 className={ui.cardTitle}>{title}</h2>
        {insight && <p className={styles.insight}>{insight}</p>}
      </div>
      {children}
    </section>
  );
}

const OUTCOMES = [
  { key: "confirmed", label: "Confirmed", className: styles.confirmed },
  { key: "cancelled", label: "Cancelled", className: styles.cancelled },
  { key: "pending", label: "Pending", className: styles.pending },
] as const;

function Legend() {
  return (
    <ul className={styles.legend}>
      {OUTCOMES.map((o) => (
        <li key={o.key}>
          <span
            className={`${styles.swatch} ${o.className}`}
            aria-hidden="true"
          />
          {o.label}
        </li>
      ))}
    </ul>
  );
}

/** Orders placed per day, stacked by their outcome. */
function DailyChart({ daily }: { daily: Analytics["daily"] }) {
  const peak = Math.max(
    1,
    ...daily.map((d) => d.confirmed + d.cancelled + d.pending),
  );
  const ticks = new Set([
    0,
    Math.floor((daily.length - 1) / 2),
    daily.length - 1,
  ]);
  return (
    <>
      <Legend />
      <div
        className={styles.daily}
        style={{ ["--days" as string]: daily.length }}
        role="img"
        aria-label={`Orders per day, from ${shortDate(daily[0].date)} to ${shortDate(daily[daily.length - 1].date)}`}
      >
        {daily.map((d) => {
          const total = d.confirmed + d.cancelled + d.pending;
          return (
            <div
              key={d.date}
              className={styles.dayCol}
              data-tip={`${shortDate(d.date)} · ${total} orders · ${d.confirmed} confirmed · ${d.cancelled} cancelled · ${d.pending} pending`}
            >
              <div
                className={styles.stack}
                style={{ height: `${(total / peak) * 100}%` }}
              >
                {OUTCOMES.map((o) =>
                  d[o.key] > 0 ? (
                    <span
                      key={o.key}
                      className={o.className}
                      style={{ flexGrow: d[o.key] }}
                    />
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className={styles.axis}
        style={{ ["--days" as string]: daily.length }}
      >
        {daily.map((d, i) => (
          <span key={d.date}>{ticks.has(i) ? shortDate(d.date) : ""}</span>
        ))}
      </div>
    </>
  );
}

/** One horizontal bar per row: label, bar scaled to the peak, value. */
function Bars({
  rows,
}: {
  rows: { label: string; value: number; display: string; note?: string }[];
}) {
  const peak = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <ul className={styles.bars}>
      {rows.map((r) => (
        <li key={r.label}>
          <span className={styles.barLabel}>{r.label}</span>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{ width: `${(r.value / peak) * 100}%` }}
            />
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

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const raw = (await searchParams).range;
  const selected = RANGES.find((r) => r.value === raw) ?? RANGES[1];
  const data = await api.analytics(selected.value);
  const { kpis, outcomes, callOutcomes } = data;
  const period = selected.period;

  const totalOrders =
    outcomes.confirmed + outcomes.cancelled + outcomes.pending;
  const finishedCalls =
    callOutcomes.confirmed + callOutcomes.failed + callOutcomes.no_answer;

  // Only hours with enough calls to say something: at least 2% of the calls, and 5 calls.
  const totalHourCalls = data.byHour.reduce((sum, h) => sum + h.calls, 0);
  const reliable = data.byHour.filter(
    (h) => h.calls >= Math.max(5, totalHourCalls * 0.02),
  );
  const hours = reliable.length
    ? data.byHour.slice(
        reliable[0].hour,
        reliable[reliable.length - 1].hour + 1,
      )
    : [];
  const byAnswerRate = [...reliable].sort(
    (a, b) => rate(b.answered, b.calls) - rate(a.answered, a.calls),
  );
  const bestHour = byAnswerRate[0] ?? null;
  const worstHour = byAnswerRate[byAnswerRate.length - 1] ?? null;

  const busiestDay = data.byWeekday.reduce((a, b) =>
    b.orders > a.orders ? b : a,
  );
  const firstAttempt = data.byAttempt.find((a) => a.attempt === 1);
  const allConfirmations = data.byAttempt.reduce(
    (sum, a) => sum + a.confirmed,
    0,
  );
  const topRevenue = [...data.byProduct].sort(
    (a, b) => b.revenue - a.revenue,
  )[0];
  const peakProductOrders = Math.max(1, ...data.byProduct.map((p) => p.orders));

  return (
    <div className={styles.page}>
      <nav className={styles.ranges} aria-label="Period">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={
              r.value === "30d" ? "/analytics" : `/analytics?range=${r.value}`
            }
            className={styles.range}
            aria-current={r.value === selected.value ? "page" : undefined}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {totalOrders === 0 ? (
        <section className={`${ui.card} ${ui.cardPad}`}>
          <p className={ui.empty}>
            No orders in this period yet. Analytics fill in as orders and calls
            come in.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.kpis} aria-label="Key figures">
            <Kpi
              label="Orders"
              value={formatNumber(kpis.orders.value)}
              change={percentChange(
                kpis.orders.value,
                kpis.orders.previous,
                false,
                period,
              )}
              hint="Orders placed in the period"
            />
            <Kpi
              label="Confirmation rate"
              value={formatPercent(kpis.confirmationRate.value)}
              change={pointsChange(
                kpis.confirmationRate.value,
                kpis.confirmationRate.previous,
                period,
              )}
              hint="Orders confirmed by the customer"
            />
            <Kpi
              label="Confirmed revenue"
              value={formatTND(Math.round(kpis.confirmedRevenue.value))}
              change={percentChange(
                kpis.confirmedRevenue.value,
                kpis.confirmedRevenue.previous,
                false,
                period,
              )}
              hint="Value of the confirmed orders"
            />
            <Kpi
              label="Cancelled before shipping"
              value={formatTND(Math.round(kpis.cancelledValue.value))}
              change={percentChange(
                kpis.cancelledValue.value,
                kpis.cancelledValue.previous,
                true,
                period,
              )}
              hint="Orders you didn't ship for nothing"
            />
            <Kpi
              label="Answer rate"
              value={formatPercent(kpis.answerRate.value)}
              change={pointsChange(
                kpis.answerRate.value,
                kpis.answerRate.previous,
                period,
              )}
              hint="Calls the customer picked up"
            />
            <Kpi
              label="Attempts per confirmation"
              value={kpis.avgAttempts.value.toFixed(2)}
              change={percentChange(
                kpis.avgAttempts.value,
                kpis.avgAttempts.previous,
                true,
                period,
              )}
              hint="Calls needed, on average"
            />
            <Kpi
              label="Time to confirm"
              value={formatMinutes(kpis.avgMinutesToConfirm.value)}
              change={percentChange(
                kpis.avgMinutesToConfirm.value,
                kpis.avgMinutesToConfirm.previous,
                true,
                period,
              )}
              hint="From order placed to confirmed"
            />
            <Kpi
              label="Average basket"
              value={formatTND(Math.round(kpis.avgOrderValue.value))}
              change={percentChange(
                kpis.avgOrderValue.value,
                kpis.avgOrderValue.previous,
                false,
                period,
              )}
              hint="Average order value"
            />
          </section>

          <div className={styles.grid}>
            <Card
              title="Orders per day"
              insight={`${formatNumber(totalOrders)} orders, ${formatPercent(rate(outcomes.confirmed, totalOrders))} confirmed`}
              wide
            >
              <DailyChart daily={data.daily} />
            </Card>

            <Card title="Order outcomes">
              <div
                className={styles.split}
                role="img"
                aria-label="Share of orders by outcome"
              >
                {OUTCOMES.map((o) =>
                  outcomes[o.key] > 0 ? (
                    <span
                      key={o.key}
                      className={o.className}
                      style={{ flexGrow: outcomes[o.key] }}
                    />
                  ) : null,
                )}
              </div>
              <dl className={styles.facts}>
                {OUTCOMES.map((o) => (
                  <div key={o.key}>
                    <dt>
                      <span
                        className={`${styles.swatch} ${o.className}`}
                        aria-hidden="true"
                      />
                      {o.label}
                    </dt>
                    <dd>
                      {formatNumber(outcomes[o.key])}
                      <small>
                        {formatPercent(rate(outcomes[o.key], totalOrders))}
                      </small>
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card
              title="Best time to call"
              insight={
                bestHour && worstHour
                  ? `Customers answer most at ${hourLabel(bestHour.hour)} (${formatPercent(rate(bestHour.answered, bestHour.calls))}) and least at ${hourLabel(worstHour.hour)} (${formatPercent(rate(worstHour.answered, worstHour.calls))}).`
                  : undefined
              }
              wide
            >
              {hours.length === 0 ? (
                <p className={ui.muted}>No calls in this period.</p>
              ) : (
                <>
                  <div
                    className={styles.hours}
                    style={{ ["--cols" as string]: hours.length }}
                    role="img"
                    aria-label="Answer rate by hour of the call"
                  >
                    {hours.map((h) => {
                      const r = rate(h.answered, h.calls);
                      return (
                        <div
                          key={h.hour}
                          className={styles.hourCol}
                          data-tip={
                            h.calls
                              ? `${hourLabel(h.hour)} · ${formatPercent(r)} answered · ${h.calls} calls`
                              : `${hourLabel(h.hour)} · no calls`
                          }
                        >
                          <span className={styles.hourValue}>
                            {h === bestHour || h === worstHour
                              ? formatPercent(r)
                              : ""}
                          </span>
                          <div className={styles.hourTrack}>
                            <div
                              className={`${styles.hourBar} ${h === bestHour ? styles.best : ""} ${reliable.includes(h) ? "" : styles.sparse}`}
                              style={{ height: `${r * 100}%` }}
                            />
                          </div>
                          <span className={styles.hourLabel}>
                            {String(h.hour).padStart(2, "0")}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className={styles.note}>
                    Share of calls answered, by hour of the call (Tunis time).
                  </p>
                </>
              )}
            </Card>

            <Card
              title="Call results"
              insight={`${formatNumber(finishedCalls)} calls made`}
            >
              <Bars
                rows={[
                  { label: "Confirmed", value: callOutcomes.confirmed },
                  { label: "Refused", value: callOutcomes.failed },
                  { label: "No answer", value: callOutcomes.no_answer },
                  { label: "Queued", value: callOutcomes.pending },
                ].map((r) => ({
                  ...r,
                  display: formatNumber(r.value),
                  note:
                    r.label === "Queued"
                      ? undefined
                      : formatPercent(rate(r.value, finishedCalls)),
                }))}
              />
            </Card>

            <Card
              title="Top products"
              insight={
                topRevenue
                  ? `${topRevenue.item} brings in the most revenue.`
                  : undefined
              }
              wide
            >
              <div className={ui.tableWrap}>
                <table className={`${ui.table} ${styles.table}`}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Orders</th>
                      <th>Confirmed</th>
                      <th>Cancelled</th>
                      <th className={styles.num}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProduct.map((p) => (
                      <tr key={p.item}>
                        <td className={ui.strong}>{p.item}</td>
                        <td>
                          <span className={styles.inlineBar}>
                            <span
                              style={{
                                width: `${(p.orders / peakProductOrders) * 100}%`,
                              }}
                            />
                          </span>
                          {formatNumber(p.orders)}
                        </td>
                        <td>{formatPercent(rate(p.confirmed, p.orders))}</td>
                        <td
                          className={
                            rate(p.cancelled, p.orders) >= 0.2
                              ? styles.alert
                              : ui.muted
                          }
                        >
                          {formatPercent(rate(p.cancelled, p.orders))}
                        </td>
                        <td className={`${ui.strong} ${styles.num}`}>
                          {formatTND(Math.round(p.revenue))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              title="Orders by weekday"
              insight={`${WEEKDAYS[busiestDay.weekday - 1]} is your busiest day.`}
            >
              <Bars
                rows={data.byWeekday.map((d) => ({
                  label: WEEKDAYS[d.weekday - 1].slice(0, 3),
                  value: d.orders,
                  display: formatNumber(d.orders),
                  note: d.orders
                    ? `${formatPercent(rate(d.confirmed, d.orders))} conf.`
                    : undefined,
                }))}
              />
            </Card>

            <Card title="Call languages" wide>
              {data.byLanguage.length === 0 ? (
                <p className={ui.muted}>No answered calls in this period.</p>
              ) : (
                <div className={ui.tableWrap}>
                  <table className={`${ui.table} ${styles.table}`}>
                    <thead>
                      <tr>
                        <th>Language</th>
                        <th>Answered calls</th>
                        <th>Share</th>
                        <th>Confirmed</th>
                        <th className={styles.num}>Avg. duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byLanguage.map((l) => {
                        const answered = data.byLanguage.reduce(
                          (s, x) => s + x.calls,
                          0,
                        );
                        return (
                          <tr key={l.language}>
                            <td className={ui.strong}>{l.language}</td>
                            <td>{formatNumber(l.calls)}</td>
                            <td className={ui.muted}>
                              {formatPercent(rate(l.calls, answered))}
                            </td>
                            <td>{formatPercent(rate(l.confirmed, l.calls))}</td>
                            <td className={`${ui.muted} ${styles.num}`}>
                              {formatDuration(l.avgDuration)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card
              title="Confirmations by attempt"
              insight={
                firstAttempt && allConfirmations
                  ? `${formatPercent(rate(firstAttempt.confirmed, allConfirmations))} of confirmations come on the first call.`
                  : undefined
              }
            >
              {data.byAttempt.length === 0 ? (
                <p className={ui.muted}>No calls in this period.</p>
              ) : (
                <Bars
                  rows={data.byAttempt.map((a) => ({
                    label: `Call ${a.attempt}`,
                    value: a.confirmed,
                    display: formatNumber(a.confirmed),
                    note: `${formatPercent(rate(a.confirmed, a.calls))} of ${a.calls}`,
                  }))}
                />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
