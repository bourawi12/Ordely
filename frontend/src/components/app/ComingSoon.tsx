import Icon, { type IconName } from "@/components/Icon";
import ui from "./ui.module.css";

export default function ComingSoon({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <section className={`${ui.card} ${ui.cardPad}`} style={{ maxWidth: 560 }}>
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 52,
          height: 52,
          marginBottom: "1rem",
          borderRadius: 14,
          background: "var(--accent-soft)",
          color: "var(--accent)",
        }}
      >
        <Icon name={icon} size={26} />
      </span>
      <h2 className={ui.cardTitle}>{title}</h2>
      <p className={ui.muted} style={{ marginBottom: 0, lineHeight: 1.6 }}>
        {text}
      </p>
    </section>
  );
}
