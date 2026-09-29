"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import styles from "./settings.module.css";

interface Tab {
  id: "profile" | "security" | "session";
  label: string;
  icon: string;
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
    <div>
      <h1 style={{ color: "blue", fontSize: "40px" }}>
        TEST SETTINGS TABS
      </h1>

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
                <Icon name={tab.icon as any} size={16} />
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