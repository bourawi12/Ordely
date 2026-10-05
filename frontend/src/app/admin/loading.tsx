import styles from "@/components/admin/admin.module.css";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={styles.kpis}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
      <div className={styles.grid} style={{ marginTop: "1.5rem" }}>
        <div className={`${styles.skeleton} ${styles.skeletonTall}`} />
        <div className={`${styles.skeleton} ${styles.skeletonTall}`} />
      </div>
    </div>
  );
}
