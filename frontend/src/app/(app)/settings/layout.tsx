import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import SettingsNav from "./settings-nav";
import styles from "./settings.module.css";

/** Settings: a bar with who is signed in and the section tabs, the open section below. */
export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await api.me();

  return (
    <div className={styles.layout}>
      <header className={`${ui.card} ${styles.bar}`}>
        {/* <div className={styles.me}>
          <span className={styles.meAvatar} aria-hidden="true">
            {user.avatarUrl ? (
              // Signed MinIO URL, different on each render: next/image would add nothing.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" />
            ) : (
              initials(user.name)
            )}
          </span>
          <span className={styles.meText}>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </span>
        </div> */}
        <SettingsNav />
      </header>
      <div className={styles.section}>{children}</div>
    </div>
  );
}
