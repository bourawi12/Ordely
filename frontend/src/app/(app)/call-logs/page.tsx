import Link from "next/link";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import ui from "@/components/app/ui.module.css";
import { api, ApiError, type CallWithOrder } from "@/lib/api";
import { formatClock, formatDateTime, formatDuration, formatTND } from "@/lib/format";
import CallDetail from "./CallDetail";
import { callLogsHref, parseParams, RANGES, STATUS_TABS } from "./params";
import RangeMenu from "./RangeMenu";
import styles from "./call-logs.module.css";

export const dynamic = "force-dynamic";

/** Up to five page numbers centred on the current page. */
function pageNumbers(page: number, pages: number) {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
}

export default async function CallLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseParams(await searchParams);
  const data = await api.listCalls({
    status: params.status,
    search: params.search,
    range: params.range,
    page: params.page,
  });

  const selectedId = params.call ?? data.items[0]?.id;
  let selected: (CallWithOrder & { attempts: number }) | null = null;
  if (selectedId) {
    selected = await api.getCall(selectedId).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    });
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const rangeLabel = RANGES.find((r) => r.value === params.range)!.label;
  const exportHref = callLogsHref(params, { page: 1, call: undefined }).replace(
    "/call-logs",
    "/call-logs/export",
  );
  const showDate = params.range !== "today";

  return (
    <>
      <div className={styles.toolbar}>
        <nav className={styles.tabs} aria-label="Filter by status">
          {STATUS_TABS.map((tab) => {
            const active = params.status === tab.value;
            return (
              <Link
                key={tab.key}
                href={callLogsHref(params, { status: tab.value, page: 1, call: undefined })}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                aria-current={active ? "true" : undefined}
              >
                {tab.label}
                <span className={styles.tabCount}>{data.counts[tab.key]}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.tools}>
          <form className={styles.search} role="search" action="/call-logs">
            <Icon name="search" size={18} />
            {params.status && <input type="hidden" name="status" value={params.status} />}
            {params.range !== "today" && <input type="hidden" name="range" value={params.range} />}
            <input
              type="search"
              name="search"
              placeholder="Search orders..."
              defaultValue={params.search}
              aria-label="Search by customer, phone or order number"
            />
          </form>
          <RangeMenu
            current={rangeLabel}
            options={RANGES.map((r) => ({
              label: r.label,
              active: r.value === params.range,
              href: callLogsHref(params, { range: r.value, page: 1, call: undefined }),
            }))}
          />
          <a href={exportHref} className={ui.btnGhost} download>
            <Icon name="download" size={18} />
            Export
          </a>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={`${ui.card} ${styles.tableCard}`}>
          {data.items.length === 0 ? (
            <p className={ui.empty}>
              No calls match these filters.{" "}
              {params.range !== "all" && (
                <Link href={callLogsHref(params, { range: "all", page: 1 })}>Search all time</Link>
              )}
            </p>
          ) : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th className={styles.wideOnly}>Phone</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Amount</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((call) => {
                    const href = callLogsHref(params, { call: call.id });
                    return (
                      <tr
                        key={call.id}
                        className={`${styles.row} ${call.id === selected?.id ? styles.rowSelected : ""}`}
                      >
                        <td className={ui.strong}>
                          <Link href={href} className={styles.rowLink} scroll={false}>
                            #{call.order.id}
                          </Link>
                        </td>
                        <td>
                          {call.order.customer}
                          <span className={`${styles.narrowOnly} ${ui.muted}`}>
                            {call.order.phone}
                          </span>
                        </td>
                        <td className={`${ui.muted} ${styles.wideOnly}`}>{call.order.phone || "—"}</td>
                        <td className={ui.muted}>
                          {showDate ? formatDateTime(call.createdAt) : formatClock(call.createdAt)}
                        </td>
                        <td>
                          <StatusBadge status={call.status} />
                        </td>
                        <td className={ui.muted}>{formatDuration(call.durationSeconds)}</td>
                        <td className={ui.strong}>{formatTND(call.order.total)}</td>
                        <td>
                          <Link
                            href={href}
                            className={styles.listen}
                            scroll={false}
                            aria-label={`${call.recordingUrl ? "Listen to" : "View"} call for order #${call.order.id}`}
                          >
                            <Icon name="play" size={16} />
                            <span className={styles.wideOnly}>
                              {call.recordingUrl ? "Listen" : "Details"}
                            </span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.footer}>
            <span>
              Showing {data.items.length} of {data.total} calls
            </span>
            {pages > 1 && (
              <nav className={styles.pager} aria-label="Pagination">
                <Link
                  href={callLogsHref(params, { page: params.page - 1, call: undefined })}
                  className={`${styles.pageBtn} ${params.page <= 1 ? styles.pageDisabled : ""}`}
                  aria-label="Previous page"
                >
                  <Icon name="chevronLeft" size={18} />
                </Link>
                {pageNumbers(params.page, pages).map((n) => (
                  <Link
                    key={n}
                    href={callLogsHref(params, { page: n, call: undefined })}
                    className={`${styles.pageBtn} ${n === params.page ? styles.pageActive : ""}`}
                    aria-current={n === params.page ? "page" : undefined}
                  >
                    {n}
                  </Link>
                ))}
                <Link
                  href={callLogsHref(params, { page: params.page + 1, call: undefined })}
                  className={`${styles.pageBtn} ${params.page >= pages ? styles.pageDisabled : ""}`}
                  aria-label="Next page"
                >
                  <Icon name="chevron" size={18} />
                </Link>
              </nav>
            )}
          </div>
        </section>

        <CallDetail call={selected} />
      </div>
    </>
  );
}
