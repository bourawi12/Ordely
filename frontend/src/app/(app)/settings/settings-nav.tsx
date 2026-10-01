"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import styles from "./settings.module.css";

const SECTIONS: {
  href: string;
  label: string;
  description: string;
  icon: IconName;
}[] = [
  {
    href: "/settings",
    label: "Profile",
    description: "Picture, name and e-mail",
    icon: "user",
  },
  {
    href: "/settings/appearance",
    label: "Appearance",
    description: "Theme and accent colour",
    icon: "palette",
  },
  {
    href: "/settings/security",
    label: "Security",
    description: "Password and session",
    icon: "lock",
  },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Settings sections">
      {SECTIONS.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={styles.navLink}
            aria-current={active ? "page" : undefined}
          >
            {/* <Icon name={s.icon} size={20} className={styles.navIcon} /> */}
            <span className={styles.navText}>
              <span className={styles.navLabel}>{s.label}</span>
              {/* <span className={styles.navDesc}>{s.description}</span> */}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
