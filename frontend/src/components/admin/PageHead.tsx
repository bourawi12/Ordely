import { Suspense } from "react";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import styles from "./admin.module.css";
import PeriodFilter from "./PeriodFilter";

/** Title, period filter and CSV export of a back office page. */
export default function PageHead({
  title,
  subtitle,
  exportHref,
  period = true,
}: {
  title: string;
  subtitle?: string;
  exportHref?: string;
  period?: boolean;
}) {
  return (
    <div className={styles.head}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className={styles.headActions}>
        {period && (
          <Suspense>
            <PeriodFilter />
          </Suspense>
        )}
        {exportHref && (
          // A plain link: the file comes from a route handler.
          <a href={exportHref} className={`${ui.btnGhost} ${styles.export}`} download>
            <Icon name="download" size={16} /> Export CSV
          </a>
        )}
      </div>
    </div>
  );
}
