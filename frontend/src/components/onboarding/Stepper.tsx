import { STEPS } from "@/lib/onboarding";
import styles from "./onboarding.module.css";

export default function Stepper({ current }: { current: number }) {
  return (
    <ol className={styles.stepper} aria-label="Progression">
      {STEPS.map((step, i) => {
        const n = i + 1;
        const state = n < current ? styles.done : n === current ? styles.current : "";
        return (
          <li
            key={step.slug}
            className={`${styles.stepItem} ${state}`}
            aria-current={n === current ? "step" : undefined}
          >
            <span className={styles.stepDot}>{n < current ? "✓" : n}</span>
            <span className={styles.stepLabel}>{step.short}</span>
          </li>
        );
      })}
    </ol>
  );
}
