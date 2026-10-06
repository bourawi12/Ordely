import ui from "@/components/app/ui.module.css";
import { Bars, Funnel } from "@/components/admin/charts";
import { delta, Kpi } from "@/components/admin/Kpi";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi } from "@/lib/admin-api";
import { parsePeriod, periodLabel, periodSearch } from "@/lib/admin-filters";
import { formatNumber, formatPercent, formatTND } from "@/lib/format";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOverview({ searchParams }: { searchParams: Search }) {
  const period = parsePeriod(await searchParams);
  const { kpis, plans, funnel } = await adminApi.overview(period);
  const paidShare = kpis.totalMerchants.value
    ? kpis.paidMerchants.value / kpis.totalMerchants.value
    : 0;
  const converted = funnel[funnel.length - 1];

  return (
    <>
      <PageHead
        title="Overview"
        subtitle={`Merchants and recurring revenue, ${periodLabel(period)}, vs the period before.`}
        exportHref={`/admin/export/overview${periodSearch(period)}`}
      />

      <section className={styles.kpis} aria-label="Key figures">
        <Kpi
          label="Total merchants"
          value={formatNumber(kpis.totalMerchants.value)}
          change={delta(kpis.totalMerchants)}
          hint="Signed up by the end of the period"
        />
        <Kpi
          label="New signups"
          value={formatNumber(kpis.newSignups.value)}
          change={delta(kpis.newSignups)}
          hint="Signed up during the period"
        />
        <Kpi
          label="Activated"
          value={formatNumber(kpis.activatedMerchants.value)}
          change={delta(kpis.activatedMerchants)}
          hint="Have had at least one AI call"
        />
        <Kpi
          label="Active (30 days)"
          value={formatNumber(kpis.activeMerchants.value)}
          change={delta(kpis.activeMerchants)}
          hint="An order or a call in the last 30 days"
        />
        <Kpi
          label="MRR"
          value={formatTND(Math.round(kpis.mrr.value))}
          change={delta(kpis.mrr)}
          hint="Monthly recurring revenue at the end of the period"
        />
        <Kpi
          label="Paid merchants"
          value={formatNumber(kpis.paidMerchants.value)}
          change={delta(kpis.paidMerchants)}
          hint={`${formatPercent(paidShare)} of all merchants`}
        />
        <Kpi
          label="Free merchants"
          value={formatNumber(kpis.freeMerchants.value)}
          change={delta(kpis.freeMerchants)}
          hint="On the free plan"
        />
        <Kpi
          label="Churned"
          value={formatNumber(kpis.churnedMerchants.value)}
          change={delta(kpis.churnedMerchants, true)}
          hint="Cancelled a paid plan during the period"
        />
      </section>

      <div className={styles.grid}>
        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>MRR by plan: {formatTND(Math.round(kpis.mrr.value))}</h2>
            <p>At the end of the period</p>
          </div>
          <Bars
            rows={plans
              .filter((p) => p.price > 0)
              .map((p) => ({
                key: p.plan,
                label: `${p.label} · ${formatTND(p.price)}`,
                value: p.mrr.value,
                display: formatTND(Math.round(p.mrr.value)),
                note: `${formatNumber(p.merchants.value)} merchants`,
              }))}
            empty="No paid merchant yet."
          />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>Free vs paid: {formatPercent(paidShare)} paid</h2>
            <p>Merchants per plan</p>
          </div>
          <Bars
            rows={plans.map((p) => ({
              key: p.plan,
              label: p.label,
              value: p.merchants.value,
              display: formatNumber(p.merchants.value),
              note: kpis.totalMerchants.value
                ? formatPercent(p.merchants.value / kpis.totalMerchants.value)
                : undefined,
            }))}
          />
        </section>

        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>
              Activation funnel: {formatPercent(converted?.ofTotal ?? 0)} of{" "}
              {formatNumber(funnel[0]?.count ?? 0)} signups upgraded
            </h2>
            <p>Merchants who signed up in the period, and how far they have got since</p>
          </div>
          <Funnel steps={funnel} />
          <p className={styles.note}>
            Steps are counted independently, so a merchant can upgrade before reaching 100 calls.
            &ldquo;First order imported&rdquo; stands in for an integration, which isn&apos;t
            tracked yet.
          </p>
        </section>
      </div>
    </>
  );
}
