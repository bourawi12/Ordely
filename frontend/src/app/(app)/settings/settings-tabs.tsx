"use client";

import { useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import styles from "./settings.module.css";

interface Tab {
  id: "profile" | "security" | "session";
  label: string;
  icon: IconName;
}

const TABS: Tab[] = [
  { id: "profile", label: "Profil", icon: "user" },
  { id: "security", label: "Sécurité", icon: "lock" },
  { id: "session", label: "Session", icon: "monitor" },
];

interface SettingsTabsProps {
  profileContent: React.ReactNode;
  securityContent: React.ReactNode;
  sessionContent: React.ReactNode;
}

export function SettingsTabs({
  profileContent,
  securityContent,
  sessionContent,
}: SettingsTabsProps) {
  const [active, setActive] = useState<Tab["id"]>("profile");

  const panels: Record<Tab["id"], React.ReactNode> = {
    profile: profileContent,
    security: securityContent,
    session: sessionContent,
  };

  return (
    <div className={styles.tabsWrapper}>
      <nav className={styles.tabNav} role="tablist" aria-label="Parametres">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={`${styles.tabBtn} ${active === tab.id ? styles.tabBtnActive : ""}`}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.tabsWrapper}>

        {/* Mini navbar */}
        <nav
          className={styles.tabNav}
          role="tablist"
          aria-label="Paramètres"
        >
          {TABS.map((tab) => {
            const isActive = active === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.id)}
                className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ""
                  }`}
              >
                <Icon name={tab.icon as IconName} size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Contenu : uniquement l'onglet actif */}
        <div className={styles.tabContent}>
          {TABS.map((tab) => {
            if (active !== tab.id) {
              return null;
            }

            return (
              <div
                key={tab.id}
                className={styles.tabPanel}
              >
                {panels[tab.id]}
              </div>
            );
          })}
        </div>

      </div> </div>
  );
}