"use client";

import { useState, type ReactNode } from "react";
import Icon from "@/components/Icon";
import type { SettingsActionState } from "./actions";
import styles from "./settings.module.css";

/** The last save result, hidden again as soon as the user edits the form. */
export function useSaveStatus(state: SettingsActionState) {
  const [dismissed, setDismissed] = useState<SettingsActionState | null>(null);
  const status = state === dismissed ? null : state;
  return [status, () => setDismissed(state)] as const;
}

export function CardHead({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.cardHead}>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Card footer: the result of the last save (or a hint) on the left, the actions on the right. */
export function CardFooter({
  status,
  hint,
  children,
}: {
  status?: SettingsActionState | null;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  const tone = status?.error
    ? "error"
    : status?.success
      ? "success"
      : undefined;
  return (
    <div className={styles.cardFoot}>
      <p
        className={styles.status}
        data-tone={tone}
        role={tone === "error" ? "alert" : "status"}
      >
        {tone && (
          <Icon name={tone === "error" ? "xCircle" : "check"} size={17} />
        )}
        <span>{status?.error ?? status?.success ?? hint}</span>
      </p>
      {children && <div className={styles.footActions}>{children}</div>}
    </div>
  );
}
