import styles from "./Logo.module.css";

interface LogoProps {
  className?: string;
  /** Draw the smile in with a stroke animation on mount. */
  animated?: boolean;
}

export default function Logo({ className, animated }: LogoProps) {
  return (
    <span
      className={`${styles.logo} ${animated ? styles.animated : ""} ${className ?? ""}`}
      aria-label="ordely"
    >
      <span aria-hidden="true">ordely</span>
      <svg
        className={styles.smile}
        viewBox="0 0 100 32"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 6 Q50 44 94 6" pathLength={1} />
      </svg>
      <sup className={styles.reg} aria-hidden="true">
        ®
      </sup>
    </span>
  );
}
