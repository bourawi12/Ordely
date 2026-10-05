import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { Bars, Empty, Heatmap } from "@/components/admin/charts";
import { delta, deltaPts, Kpi } from "@/components/admin/Kpi";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi } from "@/lib/admin-api";
import { parsePeriod, periodLabel, periodSearch } from "@/lib/admin-filters";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";

type Search = Promise<Record<string, string | string[] | undefined>>;

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const SECTORS: Record<string, string> = {
  fashion: "Fashion",
  cosmetics: "Cosmetics",
  electronics: "Electronics",
  food: "Food",
  other: "Other",
  unknown: "Not set",
};

export default async function AdminQuality({ searchParams }: { searchParams: Search }) {
  const period = parsePeriod(await searchParams);
  const q = periodSearch(period);
  const x = await adminApi.quality(period);
  const t = x.totals;

  // Best weekday × hour slot with enough calls to mean something.
  const best = x.heatmap
    .filter((c) => c.calls >= 10)
    .sort((a, b) => rate(b.confirmed, b.calls) - rate(a.confirmed, a.calls))[0];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const byDay = days.map((label, i) => {
    const cells = x.heatmap.filter((c) => c.weekday === i + 1);
    const calls = cells.reduce((s, c) => s + c.calls, 0);
    return { label, calls, confirmed: cells.reduce((s, c) => s + c.confirmed, 0) };
  });
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const cells = x.heatmap.filter((c) => c.hour === h);
    return {
      hour: h,
      calls: cells.reduce((s, c) => s + c.calls, 0),
      confirmed: cells.reduce((s, c) => s + c.confirmed, 0),
    };
  });
  // Hours with a handful of calls (night retries) would show misleading rates.
  const hourRows = byHour.filter((h) => h.calls >= 10);
  const fewHours = byHour.filter((h) => h.calls > 0 && h.calls < 10).length;

  return (
    <>
      <PageHead
        title="Call quality and outcomes"
        subtitle={`Finished AI calls, ${periodLabel(period)}. Rates are per call, all attempts included.`}
        exportHref={`/admin/export/quality${q}`}
      />

      <section className={styles.kpis} aria-label="Key figures">
        <Kpi label="Confirmation rate" value={formatPercent(t.confirmationRate.value)} change={deltaPts(t.confirmationRate)} hint={`${formatNumber(t.calls.value)} calls`} />
        <Kpi label="Cancellation rate" value={formatPercent(t.cancellationRate.value)} change={deltaPts(t.cancellationRate, true)} hint="The customer refused the order" />
        <Kpi label="No answer" value={formatPercent(t.noAnswerRate.value)} change={deltaPts(t.noAnswerRate, true)} hint="The customer didn't pick up" />
        <Kpi
          label="Avg. call duration"
          value={formatDuration(t.avgDuration.value)}
          change={delta(t.avgDuration, true)}
          hint={`${t.avgAttempts.value.toFixed(2)} attempts per confirmation`}
        />
      </section>

      <div className={styles.grid}>
        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>
              Confirmation rate by hour and weekday
              {best ? `: best ${days[best.weekday - 1]} ${String(best.hour).padStart(2, "0")}:00 (${formatPercent(rate(best.confirmed, best.calls))})` : ""}
            </h2>
            <p>Tunis time · hover a cell for the numbers</p>
          </div>
          <Heatmap cells={x.heatmap} />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>By day of week</h2>
            <p>Confirmation rate · calls</p>
          </div>
          <Bars
            rows={byDay.map((d) => ({
              key: d.label,
              label: d.label,
              value: rate(d.confirmed, d.calls),
              display: d.calls ? formatPercent(rate(d.confirmed, d.calls)) : "—",
              note: `${formatNumber(d.calls)} calls`,
            }))}
          />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>By hour of day</h2>
            <p>Confirmation rate · calls</p>
          </div>
          <Bars
            rows={hourRows.map((h) => ({
              key: h.hour,
              label: `${String(h.hour).padStart(2, "0")}:00`,
              value: rate(h.confirmed, h.calls),
              display: formatPercent(rate(h.confirmed, h.calls)),
              note: `${formatNumber(h.calls)} calls`,
            }))}
            empty="No calls in this period."
          />
          {fewHours > 0 && (
            <p className={styles.note}>
              {fewHours} hour{fewHours > 1 ? "s" : ""} with fewer than 10 calls left out.
            </p>
          )}
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>By language: {x.byLanguage[0]?.language ?? "—"} most used</h2>
            <p>Answered calls · confirmation rate · avg. duration</p>
          </div>
          <Bars
            rows={x.byLanguage.map((l) => ({
              key: l.language,
              label: l.language,
              value: rate(l.confirmed, l.calls),
              display: formatPercent(rate(l.confirmed, l.calls)),
              note: `${formatNumber(l.calls)} · ${formatDuration(l.avgDuration)}`,
            }))}
            empty="No answered calls in this period."
          />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>By product category</h2>
            <p>The merchant&apos;s sector · confirmation rate</p>
          </div>
          <Bars
            rows={x.bySector.map((s) => ({
              key: s.sector,
              label: SECTORS[s.sector] ?? s.sector,
              value: rate(s.confirmed, s.calls),
              display: formatPercent(rate(s.confirmed, s.calls)),
              note: `${formatNumber(s.calls)} calls · ${formatPercent(rate(s.refused, s.calls))} refused`,
            }))}
            empty="No calls in this period."
          />
        </section>

        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>By merchant: the {x.byMerchant.length} busiest</h2>
            <p>City isn&apos;t recorded on orders yet, so there is no breakdown by city.</p>
          </div>
          {x.byMerchant.length === 0 ? (
            <Empty>No calls in this period.</Empty>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th className={styles.num}>Calls</th>
                    <th className={styles.num}>Confirmed</th>
                    <th className={styles.num}>Refused</th>
                    <th className={styles.num}>No answer</th>
                    <th className={styles.num}>Avg. duration</th>
                  </tr>
                </thead>
                <tbody>
                  {x.byMerchant.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/admin/merchants/${m.id}${q}`} className={styles.rowLink}>
                          {m.name}
                        </Link>
                      </td>
                      <td className={styles.num}>{formatNumber(m.calls)}</td>
                      <td className={styles.num}>{formatPercent(m.confirmationRate)}</td>
                      <td className={`${styles.num} ${m.cancellationRate >= 0.25 ? styles.negative : ""}`}>
                        {formatPercent(m.cancellationRate)}
                      </td>
                      <td className={styles.num}>{formatPercent(m.noAnswerRate)}</td>
                      <td className={styles.num}>{formatDuration(m.avgDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
