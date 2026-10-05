import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { Bars, Empty } from "@/components/admin/charts";
import { delta, deltaPts, Kpi } from "@/components/admin/Kpi";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi } from "@/lib/admin-api";
import { parsePeriod, periodLabel, periodSearch } from "@/lib/admin-filters";
import { formatNumber, formatPercent, formatTND } from "@/lib/format";

type Search = Promise<Record<string, string | string[] | undefined>>;

const tnd = (v: number) => formatTND(Math.round(v * 100) / 100);

export default async function AdminRevenue({ searchParams }: { searchParams: Search }) {
  const period = parsePeriod(await searchParams);
  const q = periodSearch(period);
  const r = await adminApi.revenue(period);
  const t = r.totals;
  const losing = r.byMerchant.filter((m) => m.margin < 0);

  return (
    <>
      <PageHead
        title="Revenue and unit economics"
        subtitle={`Subscription revenue against the estimated cost of calls, ${periodLabel(period)}.`}
        exportHref={`/admin/export/revenue${q}`}
      />

      <section className={styles.kpis} aria-label="Key figures">
        <Kpi label="Revenue" value={tnd(t.revenue.value)} change={delta(t.revenue)} hint="Subscriptions, prorated to the period" />
        <Kpi label="Call cost (est.)" value={tnd(t.cost.value)} change={delta(t.cost, true)} hint={`${formatTND(r.costs.perMinute)}/min + ${formatTND(r.costs.perCall)}/call`} />
        <Kpi label="Gross margin" value={tnd(t.grossMargin.value)} change={delta(t.grossMargin)} hint={`${formatPercent(t.marginRate.value)} of revenue`} />
        <Kpi label="Margin rate" value={formatPercent(t.marginRate.value)} change={deltaPts(t.marginRate)} hint="Gross margin / revenue" />
        <Kpi label="MRR" value={tnd(t.mrr.value)} change={delta(t.mrr)} hint="At the end of the period" />
        <Kpi label="Revenue per call" value={formatTND(Math.round(t.revenuePerCall.value * 1000) / 1000)} change={delta(t.revenuePerCall)} hint="Revenue / finished calls" />
        <Kpi label="Cost per call" value={formatTND(Math.round(t.costPerCall.value * 1000) / 1000)} change={delta(t.costPerCall, true)} hint="Estimated, all attempts" />
        <Kpi label="Unprofitable merchants" value={formatNumber(losing.length)} hint="Cost more than they pay (free plan included)" />
      </section>

      <div className={styles.grid}>
        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>Revenue by plan: {tnd(t.revenue.value)}</h2>
            <p>Prorated subscription revenue in the period</p>
          </div>
          <Bars
            rows={r.byPlan
              .filter((p) => p.price > 0)
              .map((p) => ({
                key: p.plan,
                label: `${p.label} · ${formatTND(p.price)}`,
                value: p.revenue,
                display: tnd(p.revenue),
                note: `${formatNumber(p.merchants)} on it now`,
              }))}
            empty="No paid plan yet."
          />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>Margin by plan</h2>
            <p>Revenue − estimated call cost, current plan</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th className={styles.num}>Merchants</th>
                  <th className={styles.num}>Revenue</th>
                  <th className={styles.num}>Cost</th>
                  <th className={styles.num}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {r.byPlan.map((p) => (
                  <tr key={p.plan}>
                    <td>{p.label}</td>
                    <td className={styles.num}>{formatNumber(p.merchants)}</td>
                    <td className={styles.num}>{tnd(p.revenue)}</td>
                    <td className={styles.num}>{tnd(p.cost)}</td>
                    <td className={`${styles.num} ${p.margin < 0 ? styles.negative : ""}`}>{tnd(p.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>Margin per merchant: {losing.length} below zero</h2>
            <p>Lowest margin first</p>
          </div>
          {r.byMerchant.length === 0 ? (
            <Empty>No revenue and no calls in this period.</Empty>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Plan</th>
                    <th className={styles.num}>Calls</th>
                    <th className={styles.num}>Minutes</th>
                    <th className={styles.num}>Revenue</th>
                    <th className={styles.num}>Cost</th>
                    <th className={styles.num}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byMerchant.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/admin/merchants/${m.id}${q}`} className={styles.rowLink}>
                          {m.name}
                        </Link>
                      </td>
                      <td>{m.plan}</td>
                      <td className={styles.num}>{formatNumber(m.calls)}</td>
                      <td className={styles.num}>{formatNumber(Math.round(m.minutes))}</td>
                      <td className={styles.num}>{tnd(m.revenue)}</td>
                      <td className={styles.num}>{tnd(m.cost)}</td>
                      <td className={`${styles.num} ${m.margin < 0 ? styles.negative : ""}`}>{tnd(m.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.note}>
            Costs are estimates: COST_PER_MINUTE × connected minutes + COST_PER_CALL × attempts
            (environment). Revenue is each paid plan&apos;s monthly price prorated to the days it ran
            in the period.
          </p>
        </section>
      </div>
    </>
  );
}
