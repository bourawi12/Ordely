import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { Bars, Empty, LineChart } from "@/components/admin/charts";
import { delta, Kpi } from "@/components/admin/Kpi";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi } from "@/lib/admin-api";
import { parsePeriod, periodLabel, periodSearch } from "@/lib/admin-filters";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUsage({ searchParams }: { searchParams: Search }) {
  const period = parsePeriod(await searchParams);
  const q = periodSearch(period);
  const u = await adminApi.usage(period);
  const dates = u.daily.map((d) => d.date);
  const perDay = (n: number) => formatNumber(Math.round(n / Math.max(u.daily.length, 1)));

  return (
    <>
      <PageHead
        title="Usage and behaviour"
        subtitle={`How merchants use Ordely, ${periodLabel(period)}.`}
        exportHref={`/admin/export/usage${q}`}
      />

      <section className={styles.kpis} aria-label="Key figures">
        <Kpi label="AI calls" value={formatNumber(u.totals.calls.value)} change={delta(u.totals.calls)} hint={`${perDay(u.totals.calls.value)} per day`} />
        <Kpi label="Orders" value={formatNumber(u.totals.orders.value)} change={delta(u.totals.orders)} hint={`${perDay(u.totals.orders.value)} per day`} />
        <Kpi
          label="Calls per merchant"
          value={formatNumber(Math.round(u.totals.avgCallsPerMerchant.value))}
          change={delta(u.totals.avgCallsPerMerchant)}
          hint="Average, over merchants who made calls"
        />
        <Kpi
          label="Quota used"
          value={formatPercent(u.totals.avgQuotaUsed)}
          hint="Average share of the monthly quota, this month"
        />
      </section>

      <div className={styles.grid}>
        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>
              Calls and orders per day: {perDay(u.totals.calls.value)} calls, {perDay(u.totals.orders.value)} orders
            </h2>
            <p>Finished AI calls (all attempts) and orders received</p>
          </div>
          <LineChart
            dates={dates}
            series={[
              { label: "Calls", values: u.daily.map((d) => d.calls), tone: "a" },
              { label: "Orders", values: u.daily.map((d) => d.orders), tone: "b" },
            ]}
          />
        </section>

        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>
              Merchants calling per day: up to{" "}
              {formatNumber(Math.max(0, ...u.daily.map((d) => d.activeMerchants)))}
            </h2>
            <p>Distinct merchants with at least one call that day</p>
          </div>
          <LineChart dates={dates} series={[{ label: "Merchants", values: u.daily.map((d) => d.activeMerchants) }]} height={160} />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>Upsell candidates: {u.upsell.length}</h2>
            <p>Above 80% of their monthly quota this month</p>
          </div>
          <Bars
            rows={u.upsell.map((m) => ({
              key: m.id,
              label: m.name,
              href: `/admin/merchants/${m.id}${q}`,
              value: m.share,
              display: formatPercent(m.share),
              note: `${formatNumber(m.used)} / ${formatNumber(m.quota)} · ${m.plan}`,
            }))}
            empty="No merchant is close to its quota this month."
          />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>Top merchants: {u.top[0] ? `${u.top[0].name} leads` : "none yet"}</h2>
            <p>By AI calls in the period</p>
          </div>
          <Bars
            rows={u.top.map((m) => ({
              key: m.id,
              label: m.name,
              href: `/admin/merchants/${m.id}${q}`,
              value: m.calls,
              display: formatNumber(m.calls),
              note: `${formatNumber(m.orders)} orders · ${m.plan}`,
            }))}
            empty="No calls in this period."
          />
        </section>

        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>Dormant merchants: {u.dormant.length} at risk of churning</h2>
            <p>No order and no call for {u.dormantDays} days or more</p>
          </div>
          {u.dormant.length === 0 ? (
            <Empty>Nobody has gone quiet. Good.</Empty>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Plan</th>
                    <th>Last activity</th>
                    <th className={styles.num}>Idle</th>
                    <th className={styles.num}>Calls, all time</th>
                  </tr>
                </thead>
                <tbody>
                  {u.dormant.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/admin/merchants/${m.id}${q}`} className={styles.rowLink}>
                          {m.name}
                        </Link>
                      </td>
                      <td>{m.plan}</td>
                      <td>{formatDate(m.lastActivityAt)}</td>
                      <td className={styles.num}>{m.daysIdle} days</td>
                      <td className={styles.num}>{formatNumber(m.callsTotal)}</td>
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
