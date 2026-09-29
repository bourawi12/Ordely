import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AppearanceForm } from "../appearance-form";
import styles from "../settings.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Appearance settings — Ordely" };

export default async function AppearanceSettingsPage() {
  const user = await api.me();

  return (
    <>
      <header className={styles.pageHead}>
        <h2>Appearance</h2>
        <p>Make Ordely yours: pick a theme and the colour of the app.</p>
      </header>
      <AppearanceForm accentColor={user.accentColor} themeMode={user.themeMode} />
    </>
  );
}
