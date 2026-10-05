import ui from "@/components/app/ui.module.css";
import { Empty } from "@/components/admin/charts";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi } from "@/lib/admin-api";
import { formatNumber, formatPercent } from "@/lib/format";

const WEEKS = [1, 2, 4, 8] as const;

const weekLabel = (date: string) =>
  `Week of ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;

export default async function AdminCohorts() {
  const { cohorts, weeks } = await adminApi.cohorts(12);
  const avg = (k: (typeof WEEKS)[number]) => {
    const ready = cohorts.filter((c) => c.retention[`week${k}`] !== null && c.size > 0);
    const size = ready.reduce((s, c) => s + c.size, 0);
    return size ? ready.reduce((s, c) => s + (c.retention[`week${k}`] ?? 0) * c.size, 0) / size : null;
  };
  const w4 = avg(4);

  return (
    <>
      <PageHead
        title="Cohorts"
        subtitle={`Merchants grouped by signup week (last ${weeks} weeks): who is still active later on.`}
        exportHref="/admin/export/cohorts?weeks=12"
        period={false}
      />
      <section className={`${ui.card} ${styles.card}`}>
        <div className={styles.cardHead}>
          <h2>Retention by weekly cohort{w4 !== null ? `: ${formatPercent(w4)} still active after 4 weeks` : ""}</h2>
          <p>Active = at least one order or AI call in that week after signup</p>
        </div>
        {cohorts.length === 0 ? (
          <Empty>No signups in the last {weeks} weeks.</Empty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th className={styles.num}>Merchants</th>
                  {WEEKS.map((k) => (
                    <th key={k} className={styles.num}>
                      Week {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.week}>
                    <td>{weekLabel(c.week)}</td>
                    <td className={styles.num}>{formatNumber(c.size)}</td>
                    {WEEKS.map((k) => {
                      const v = c.retention[`week${k}`];
                      return (
                        <td
                          key={k}
                          className={`${styles.num} ${styles.cohortCell}`}
                          style={v === null ? undefined : { ["--level" as string]: `${Math.round(v * 100)}%` }}
                          title={v === null ? "Not reached yet" : `${formatPercent(v)} of ${c.size}`}
                        >
                          {v === null ? "·" : formatPercent(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Weighted average</strong>
                  </td>
                  <td className={styles.num}>{formatNumber(cohorts.reduce((s, c) => s + c.size, 0))}</td>
                  {WEEKS.map((k) => {
                    const v = avg(k);
                    return (
                      <td key={k} className={styles.num}>
                        <strong>{v === null ? "·" : formatPercent(v)}</strong>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.note}>
          Week k = days 7k to 7k+6 after the merchant&apos;s own signup. A cell shows · until every
          merchant of the cohort has lived through that week.
        </p>
      </section>
    </>
  );
}
