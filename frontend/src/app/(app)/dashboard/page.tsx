import Link from "next/link";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { CallAllPendingButton, CallNowButton } from "@/components/app/CallButtons";
import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import {
  formatDuration,
  formatNumber,
  formatTND,
  percentChange,
  secondsChange,
  timeAgo,
  weekdayLabel,
  type Change,
} from "@/lib/format";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

/** A 30-day metric; the whole card opens the list it counts. */
function StatCard({
  label,
  value,
  change,
  href,
}: {
  label: string;
  value: string;
  change: Change;
  href: string;
}) {
  const tone = change.good === null ? styles.flat : change.good ? styles.up : styles.down;
  return (
    <Link href={href} className={`${ui.card} ${styles.stat} ${styles.statLink}`}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      <p className={`${styles.change} ${tone}`}>{change.text}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const { stats, week, recentCalls, pendingOrders, pendingCount, actionCounts } = await api.dashboard();
  const now = Date.now();
  const peak = Math.max(1, ...week.map((d) => d.confirmed));
  const reviewCalls = recentCalls.filter((call) => call.disposition === "needs_human");

  return (
    <div className={styles.page}>
      <section className={styles.stats} aria-label="Last 30 days">
        <StatCard
          label="Total orders"
          href="/orders"
          value={formatNumber(stats.totalOrders.value)}
          change={percentChange(stats.totalOrders.value, stats.totalOrders.previous)}
        />
        <StatCard
          label="Confirmed"
          href="/orders?status=confirmed"
          value={formatNumber(stats.confirmedOrders.value)}
          change={percentChange(stats.confirmedOrders.value, stats.confirmedOrders.previous)}
        />
        <StatCard
          label="Cancelled orders"
          href="/orders?status=cancelled"
          value={formatNumber(stats.cancelledOrders.value)}
          change={percentChange(stats.cancelledOrders.value, stats.cancelledOrders.previous)}
        />
        <StatCard
          label="Failed / No answer"
          href="/call-logs?range=30d&status=failed"
          value={formatNumber(stats.failedCalls.value)}
          change={percentChange(stats.failedCalls.value, stats.failedCalls.previous, true)}
        />
        <StatCard
          label="Avg. call duration"
          href="/call-logs?range=30d"
          value={formatDuration(stats.avgDuration.value).replace(/^0m /, "")}
          change={secondsChange(stats.avgDuration.value, stats.avgDuration.previous)}
        />
      </section>

      <section className={`${ui.card} ${ui.cardPad}`} aria-labelledby="action-queue-title">
        <div className={ui.cardHead}>
          <div>
            <h2 id="action-queue-title" className={ui.cardTitle}>Action queue</h2>
            <p className={ui.muted}>The work that needs attention first.</p>
          </div>
          {pendingCount > 0 && <CallAllPendingButton disabled={false} />}
        </div>
        <div className={styles.actionGrid}>
          <Link href="/orders?status=pending" className={styles.actionCard}>
            <span className={styles.actionLabel}>Pending</span>
            <strong className={styles.actionValue}>{pendingCount}</strong>
            <span className={styles.actionHint}>Open the order queue <Icon name="arrow" size={15} /></span>
          </Link>
          <Link href="/call-logs?range=all&status=failed" className={styles.actionCard}>
            <span className={styles.actionLabel}>Failed or no answer</span>
            <strong className={styles.actionValue}>{actionCounts.retryable}</strong>
            <span className={styles.actionHint}>Review recent attempts <Icon name="arrow" size={15} /></span>
          </Link>
          <Link href="/call-logs?range=all" className={`${styles.actionCard} ${actionCounts.needsReview ? styles.actionCardAlert : ""}`}>
            <span className={styles.actionLabel}>Needs human review</span>
            <strong className={styles.actionValue}>{actionCounts.needsReview}</strong>
            <span className={styles.actionHint}>Open call details <Icon name="arrow" size={15} /></span>
          </Link>
        </div>
        {reviewCalls.length > 0 && (
          <ul className={styles.reviewList} aria-label="Calls needing review">
            {reviewCalls.slice(0, 3).map((call) => (
              <li key={call.id}>
                <Link href={`/call-logs?range=all&call=${call.id}`}>
                  <strong>{call.order.customer}</strong>
                  <span>Order #{call.order.id} · review outcome</span>
                </Link>
                <StatusBadge status={call.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.middle}>
        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Confirmations this week</h2>
            <span className={ui.pill}>Last 7 days</span>
          </div>
          <div className={styles.chart} role="img" aria-label={week.map((d) => `${weekdayLabel(d.date)}: ${d.confirmed}`).join(", ")}>
            {week.map((d, i) => (
              <div key={d.date} className={styles.day}>
                <div className={styles.track}>
                  <div
                    className={styles.bar}
                    style={{ height: `${(d.confirmed / peak) * 100}%`, ["--i" as string]: i }}
                    title={`${d.confirmed} confirmed`}
                  >
                    {d.confirmed > 0 && <span className={styles.barValue}>{d.confirmed}</span>}
                  </div>
                </div>
                {weekdayLabel(d.date)}
              </div>
            ))}
          </div>
        </section>

        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Recent calls</h2>
          </div>
          {recentCalls.length === 0 ? (
            <p className={ui.muted}>No calls yet.</p>
          ) : (
            <ul className={styles.calls}>
              {recentCalls.map((call) => (
                <li key={call.id}>
                  <Link href={`/call-logs?range=all&call=${call.id}`}>
                    <span className={styles.callName}>{call.order.customer}</span>
                    <span className={styles.callMeta}>
                      #{call.order.id} · {timeAgo(call.createdAt, now)}
                    </span>
                  </Link>
                  <StatusBadge status={call.status} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/call-logs" className={styles.viewAll}>
            View all call logs <Icon name="arrow" size={16} />
          </Link>
        </section>
      </div>

      <section className={`${ui.card} ${ui.cardPad}`}>
        <div className={ui.cardHead}>
          <h2 className={ui.cardTitle}>
            Pending confirmation{" "}
            {pendingCount > pendingOrders.length && (
              <span className={ui.muted}>
                ({pendingOrders.length} of {pendingCount})
              </span>
            )}
          </h2>
          <CallAllPendingButton disabled={pendingCount === 0} />
        </div>
        {pendingOrders.length === 0 ? (
          <p className={ui.empty}>Every order is confirmed. Nice work!</p>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Total</th>
                  <th>Time placed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <tr key={order.id}>
                    <td className={ui.strong}>
                      <Link href={`/orders/${order.id}`}>#{order.id}</Link>
                    </td>
                    <td>{order.customer}</td>
                    <td className={ui.muted}>{order.phone || "—"}</td>
                    <td className={ui.strong}>{formatTND(order.total)}</td>
                    <td className={ui.muted}>{timeAgo(order.createdAt, now)}</td>
                    <td>
                      <CallNowButton orderId={order.id} queued={order.callQueued} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pendingCount > 0 && (
          <Link href="/orders?status=pending" className={styles.viewAll}>
            View all pending orders <Icon name="arrow" size={16} />
          </Link>
        )}
      </section>
    </div>
  );
}
