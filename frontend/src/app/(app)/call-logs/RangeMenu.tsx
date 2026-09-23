"use client";

import Link from "next/link";
import { useRef } from "react";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import styles from "./call-logs.module.css";

export default function RangeMenu({
  current,
  options,
}: {
  current: string;
  options: { label: string; href: string; active: boolean }[];
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className={styles.menu}>
      <summary className={ui.btnGhost}>
        <Icon name="calendar" size={18} />
        {current}
      </summary>
      <div className={styles.menuList}>
        {options.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className={o.active ? styles.menuActive : undefined}
            onClick={() => ref.current?.removeAttribute("open")}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
