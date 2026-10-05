import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import { LineChart } from "@/components/admin/charts";
import { Kpi } from "@/components/admin/Kpi";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { parsePeriod, periodLabel, periodSearch } from "@/lib/admin-filters";
import { formatDate, formatNumber, formatPercent, formatTND, timeAgo } from "@/lib/format";

type Search = Promise<Record<string, string | string[] | undefined>>;

const healthLevel = (s: number) => (s >= 70 ? "good" : s >= 40 ? "fair" : "poor");

export default async function AdminMerchant({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const period = parsePeriod(await searchParams);
  const detail = await adminApi.merchant(id, period).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });
  const { merchant: m, shop, daily } = detail;
  const dates = daily.map((d) => d.date);
  // Daily confirmation rate, only on days with enough calls to mean something.
  const ratePct = daily.map((d) => (d.calls >= 3 ? Math.round((d.confirmed / d.calls) * 100) : 0));

  return (
    <>
      <Link href={`/admin/merchants${periodSearch(period)}`} className={styles.back}>
        <Icon name="chevronLeft" size={16} /> All merchants
      </Link>
      <PageHead
        title={m.name}
        subtitle={`${m.ownerName ?? "—"} · ${m.ownerEmail ?? "—"} · signed up ${formatDate(m.signupAt)} · ${periodLabel(period)}`}
      />

      <section className={styles.kpis} aria-label="Key figures">
        <Kpi label="Health" value={`${m.health} / 100`} hint={`Status: ${m.status}`} />
        <Kpi label="Orders" value={formatNumber(m.orders)} hint={`${formatNumber(m.ordersTotal)} all time`} />
        <Kpi label="AI calls" value={formatNumber(m.calls)} hint={`${formatNumber(m.callsTotal)} all time`} />
        <Kpi
          label="Confirmation rate"
          value={m.confirmationRate === null ? "—" : formatPercent(m.confirmationRate)}
          hint={`${formatNumber(m.refused)} refused · ${formatNumber(m.noAnswer)} no answer`}
        />
        <Kpi label="Plan" value={m.plan} hint={m.planStartedAt ? `Paid since ${formatDate(m.planStartedAt)}` : "Never paid"} />
        <Kpi
          label="Quota this month"
          value={formatPercent(m.quotaUsed)}
          hint={`${formatNumber(m.monthCalls)} of ${formatNumber(m.quota)} calls`}
        />
        <Kpi label="Revenue" value={formatTND(Math.round(m.revenue * 100) / 100)} hint="In the period" />
        <Kpi
          label="Margin (est.)"
          value={formatTND(Math.round(m.margin * 100) / 100)}
          hint={`Call cost ${formatTND(Math.round(m.cost * 100) / 100)}`}
        />
      </section>

      <div className={styles.grid}>
        <section className={`${ui.card} ${styles.card} ${styles.full}`}>
          <div className={styles.cardHead}>
            <h2>
              Orders and calls per day: {formatNumber(m.orders)} orders, {formatNumber(m.calls)} calls
            </h2>
            <p>Hover the chart for a day&apos;s numbers</p>
          </div>
          <LineChart
            dates={dates}
            series={[
              { label: "Calls", values: daily.map((d) => d.calls), tone: "a" },
              { label: "Orders", values: daily.map((d) => d.orders), tone: "b" },
            ]}
          />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>
              Daily confirmation rate:{" "}
              {m.confirmationRate === null ? "no calls" : `${formatPercent(m.confirmationRate)} overall`}
            </h2>
            <p>Days with fewer than 3 calls show 0</p>
          </div>
          <LineChart dates={dates} series={[{ label: "Confirmed", values: ratePct }]} format={(v) => `${Math.round(v)}%`} height={160} />
        </section>

        <section className={`${ui.card} ${styles.card}`}>
          <div className={styles.cardHead}>
            <h2>Account</h2>
            <span className={styles.health} data-level={healthLevel(m.health)}>
              {m.health}
            </span>
          </div>
          <dl className={styles.facts}>
            <dt>Status</dt>
            <dd>
              <span className={styles.status} data-status={m.status}>
                {m.status}
              </span>
            </dd>
            <dt>Last activity</dt>
            <dd>{m.lastActivityAt ? timeAgo(m.lastActivityAt) : "Never"}</dd>
            <dt>Onboarding</dt>
            <dd>{shop?.onboardingCompletedAt ? `Done ${formatDate(shop.onboardingCompletedAt)}` : "Not finished"}</dd>
            <dt>Churned</dt>
            <dd>{m.churnedAt ? formatDate(m.churnedAt) : "—"}</dd>
            <dt>Sector</dt>
            <dd>{m.sector ?? "—"}</dd>
            <dt>Platform</dt>
            <dd>{shop?.platform ?? "—"}</dd>
            <dt>Call languages</dt>
            <dd>{shop?.callLanguages.join(", ") || "—"}</dd>
            <dt>Call hours</dt>
            <dd>{shop?.callStartTime ? `${shop.callStartTime}–${shop.callEndTime}` : "—"}</dd>
            <dt>Declared volume</dt>
            <dd>{shop?.dailyOrderVolume ?? "—"}</dd>
            <dt>Came from</dt>
            <dd>{shop?.acquisitionSource ?? "—"}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
