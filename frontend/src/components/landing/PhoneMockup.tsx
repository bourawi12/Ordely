import Logo from "@/components/Logo";
import Icon, { type IconName } from "@/components/Icon";
import styles from "./landing.module.css";

const rows: { icon: IconName; label: string; value?: string }[] = [
  { icon: "phone", label: "Appels en cours", value: "12" },
  { icon: "check", label: "Commandes confirmées", value: "348" },
  { icon: "history", label: "Historique" },
  { icon: "sliders", label: "Paramètres" },
];

export default function PhoneMockup() {
  return (
    <div className={styles.phoneWrap}>
      <div className={styles.phone} aria-hidden="true">
        <div className={styles.notch} />
        <div className={styles.phoneStatus}>
          <span>9:41</span>
          <span className={styles.phoneSignal} />
        </div>

        <Logo className={styles.phoneLogo} />

        {/* Two cards that cross-fade in a loop: calling → confirmed. */}
        <div className={styles.liveSlot}>
          <div className={`${styles.liveCard} ${styles.calling}`}>
            <span className={styles.ring}>
              <Icon name="phone" size={18} />
            </span>
            <div>
              <strong>Appel en cours…</strong>
              <small>Commande #1042 · Sami B.</small>
            </div>
          </div>
          <div className={`${styles.liveCard} ${styles.confirmed}`}>
            <span className={styles.checkBadge}>
              <svg viewBox="0 0 24 24">
                <path d="m6 12.5 4 4 8-9" pathLength={1} />
              </svg>
            </span>
            <div>
              <strong>Commande confirmée !</strong>
              <small>Votre client a bien confirmé sa commande par téléphone.</small>
            </div>
          </div>
        </div>

        <div className={styles.phoneStats}>
          <div>
            <b>98,7%</b>
            <small>Taux de réussite</small>
          </div>
          <div>
            <b>2 min</b>
            <small>Temps moyen d&apos;appel</small>
          </div>
        </div>

        <ul className={styles.phoneList}>
          {rows.map((row) => (
            <li key={row.label}>
              <Icon name={row.icon} size={15} />
              <span>{row.label}</span>
              {row.value ? (
                <b>{row.value}</b>
              ) : (
                <Icon name="chevron" size={14} className={styles.chevron} />
              )}
            </li>
          ))}
        </ul>

        <div className={styles.tabBar}>
          <span className={styles.tabActive}>
            <Icon name="home" size={16} />
            Accueil
          </span>
          <span>
            <Icon name="chart" size={16} />
            Statistiques
          </span>
          <span>
            <Icon name="sliders" size={16} />
            Paramètres
          </span>
        </div>
      </div>

      <div className={`${styles.floatChip} ${styles.chipTop}`} aria-hidden="true">
        <span className={styles.liveDot} />
        Appel IA · 1:47
      </div>
      <div className={`${styles.floatChip} ${styles.chipBottom}`} aria-hidden="true">
        <Icon name="check" size={18} />
        +1 commande confirmée
      </div>
    </div>
  );
}
