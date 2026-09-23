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

function StatCard({ label, value, change }: { label: string; value: string; change: Change }) {
  const tone = change.good === null ? styles.flat : change.good ? styles.up : styles.down;
  return (
    <div className={`${ui.card} ${styles.stat}`}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      <p className={`${styles.change} ${tone}`}>{change.text}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const { stats, week, recentCalls, pendingOrders, pendingCount } = await api.dashboard();
  const now = Date.now();
  const peak = Math.max(1, ...week.map((d) => d.confirmed));

  return (
    <div className={styles.page}>
      <section className={styles.stats} aria-label="Last 30 days">
        <StatCard
          label="Total orders"
          value={formatNumber(stats.totalOrders.value)}
          change={percentChange(stats.totalOrders.value, stats.totalOrders.previous)}
        />
        <StatCard
          label="Confirmed"
          value={formatNumber(stats.confirmedOrders.value)}
          change={percentChange(stats.confirmedOrders.value, stats.confirmedOrders.previous)}
        />
        <StatCard
          label="Failed / No answer"
          value={formatNumber(stats.failedCalls.value)}
          change={percentChange(stats.failedCalls.value, stats.failedCalls.previous, true)}
        />
        <StatCard
          label="Avg. call duration"
          value={formatDuration(stats.avgDuration.value).replace(/^0m /, "")}
          change={secondsChange(stats.avgDuration.value, stats.avgDuration.previous)}
        />
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
      </section>
    </div>
  );
}
