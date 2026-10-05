import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { Empty } from "@/components/admin/charts";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi, qs, type MerchantsQuery } from "@/lib/admin-api";
import { parseMerchantFilters, parsePeriod, periodLabel, periodSearch, STATUSES } from "@/lib/admin-filters";
import { formatDate, formatNumber, formatPercent, timeAgo } from "@/lib/format";

type Search = Promise<Record<string, string | string[] | undefined>>;

const PLANS = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "pro", label: "Pro" },
];

const COLUMNS: { key: string; label: string; num?: boolean }[] = [
  { key: "name", label: "Merchant" },
  { key: "signupAt", label: "Signed up" },
  { key: "plan", label: "Plan" },
  { key: "quotaUsed", label: "Calls / quota (month)" },
  { key: "orders", label: "Orders", num: true },
  { key: "calls", label: "Calls", num: true },
  { key: "confirmationRate", label: "Confirmed", num: true },
  { key: "lastActivityAt", label: "Last activity" },
  { key: "health", label: "Health", num: true },
];

function healthLevel(score: number) {
  return score >= 70 ? "good" : score >= 40 ? "fair" : "poor";
}

export default async function AdminMerchants({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const period = parsePeriod(raw);
  const filters = parseMerchantFilters(raw);
  const query: MerchantsQuery = { ...period, ...filters };
  const { rows, total } = await adminApi.merchants(query);
  const sort = filters.sort ?? "health";
  const dir = filters.dir ?? (sort === "name" ? "asc" : "desc");
  const now = Date.now();

  const sortHref = (key: string) => {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc";
    return `/admin/merchants${qs({ ...query, sort: key, dir: nextDir })}`;
  };

  return (
    <>
      <PageHead
        title="Merchants"
        subtitle={`${formatNumber(total)} merchants · orders, calls and confirmation over the ${periodLabel(period)}.`}
        exportHref={`/admin/export/merchants${qs(query)}`}
      />

      <section className={`${ui.card} ${styles.card}`}>
        <form className={styles.filters} action="/admin/merchants">
          {/* Keep the period and the sort when filtering. */}
          {Object.entries({ range: period.range, from: period.from, to: period.to, sort: filters.sort, dir: filters.dir }).map(
            ([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />,
          )}
          <label>
            Search
            <input
              type="search"
              name="search"
              defaultValue={filters.search}
              placeholder="Shop, owner or e-mail"
              className={ui.input}
            />
          </label>
          <label>
            Plan
            <select name="plan" defaultValue={filters.plan ?? ""} className={ui.input}>
              <option value="">All plans</option>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ""} className={ui.input}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={ui.btn}>
            Apply
          </button>
          {(filters.search || filters.plan || filters.status) && (
            <Link href={`/admin/merchants${periodSearch(period)}`} className={ui.btnGhost}>
              Clear
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <Empty>No merchant matches these filters.</Empty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={c.num ? styles.num : undefined}
                      aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    >
                      <Link href={sortHref(c.key)} aria-current={sort === c.key || undefined}>
                        {c.label}
                        {sort === c.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                      </Link>
                    </th>
                  ))}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/admin/merchants/${m.id}${periodSearch(period)}`} className={styles.rowLink}>
                        {m.name}
                      </Link>
                      <span className={styles.sub}>{m.ownerEmail ?? "—"}</span>
                    </td>
                    <td>{formatDate(m.signupAt)}</td>
                    <td>{m.plan}</td>
                    <td>
                      <span className={styles.quota} data-high={m.quotaUsed >= 0.8 || undefined}>
                        <span className={styles.quotaTrack} aria-hidden="true">
                          <span style={{ width: `${Math.min(100, m.quotaUsed * 100)}%` }} />
                        </span>
                        {formatNumber(m.monthCalls)} / {formatNumber(m.quota)}
                      </span>
                    </td>
                    <td className={styles.num}>{formatNumber(m.orders)}</td>
                    <td className={styles.num}>{formatNumber(m.calls)}</td>
                    <td className={styles.num}>
                      {m.confirmationRate === null ? "—" : formatPercent(m.confirmationRate)}
                    </td>
                    <td>{m.lastActivityAt ? timeAgo(m.lastActivityAt, now) : "Never"}</td>
                    <td className={styles.num}>
                      <span className={styles.health} data-level={healthLevel(m.health)}>
                        {m.health}
                      </span>
                    </td>
                    <td>
                      <span className={styles.status} data-status={m.status}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.note}>
          <strong>Health (0–100)</strong> = recency 40 (last order or call ≤ 7 days: 40, ≤ 14: 25,
          ≤ 30: 10) + results 30 (confirmation rate over the period × 30) + momentum 20 (calls of
          the last 14 days vs the 14 before: steady or growing 20, down less than 30% 10) + setup 10
          (onboarding done). <strong>Status</strong>: churned (cancelled a paid plan), new (signed up
          less than 14 days ago), dormant (no activity for 14 days), otherwise active.
        </p>
      </section>
    </>
  );
}
