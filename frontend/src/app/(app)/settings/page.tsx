import type { Metadata } from "next";
import { logout } from "@/app/(auth)/actions";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { AvatarForm } from "./avatar-form";
import { PasswordForm, ProfileForm } from "./settings-forms";
import { SettingsTabs } from "./settings-tabs";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Paramètres — Ordely",
};

export default async function SettingsPage() {
  const user = await api.me();

  return (
    <div className={styles.container}>
      <SettingsTabs
        profileContent={
          <div>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Profil du commerçant</h2>
              <p className={styles.panelDesc}>
                Gérez les informations d&apos;identification de votre compte.
              </p>
            </div>
            <AvatarForm name={user.name} avatarUrl={user.avatarUrl} />
            <ProfileForm initialName={user.name} email={user.email} />
          </div>
        }
        securityContent={
          <div>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Sécurité &amp; Mot de passe</h2>
              <p className={styles.panelDesc}>
                Modifiez votre mot de passe pour sécuriser l&apos;accès à votre boutique.
              </p>
            </div>
            <PasswordForm />
          </div>
        }
        sessionContent={
          <div>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Session</h2>
              <p className={styles.panelDesc}>Informations sur votre session active.</p>
            </div>
            <dl className={styles.sessionGrid}>
              <dt className={ui.muted}>Membre depuis</dt>
              <dd>{formatDateTime(user.createdAt)}</dd>
            </dl>
            <form action={logout}>
              <button type="submit" className={ui.btnGhost}>
                <Icon name="logout" size={18} /> Se déconnecter
              </button>
            </form>
          </div>
        }
      />
    </div>
  );
}
