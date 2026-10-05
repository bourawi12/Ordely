import { percentChange, pointsChange, type Change } from "@/lib/format";
import ui from "@/components/app/ui.module.css";
import styles from "./admin.module.css";

/** A headline number with its change vs the previous period. */
export function Kpi({
  label,
  value,
  change,
  hint,
}: {
  label: string;
  value: string;
  change?: Change;
  hint?: string;
}) {
  const tone = !change || change.good === null ? styles.flat : change.good ? styles.up : styles.down;
  return (
    <div className={`${ui.card} ${styles.kpi}`}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      {change && <p className={`${styles.change} ${tone}`}>{change.text}</p>}
      {hint && <p className={styles.kpiHint}>{hint}</p>}
    </div>
  );
}

/** Change of a count or amount: "+12% vs previous period". */
export function delta(m: { value: number; previous: number }, lowerIsBetter = false): Change {
  return percentChange(m.value, m.previous, lowerIsBetter, "previous period");
}

/** Change of a 0–1 rate in points: "+3.2 pts vs previous period". */
export function deltaPts(m: { value: number; previous: number }, lowerIsBetter = false): Change {
  const c = pointsChange(m.value, m.previous, "previous period");
  return lowerIsBetter && c.good !== null ? { ...c, good: !c.good } : c;
}
