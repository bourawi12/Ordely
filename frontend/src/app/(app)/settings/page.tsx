import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AvatarForm } from "./avatar-form";
import { ProfileForm } from "./settings-forms";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile settings — Ordely" };

export default async function ProfileSettingsPage() {
  const user = await api.me();

  return (
    <>
     {/*  <header className={styles.pageHead}>
        <h2>Profile</h2>
        <p>How you appear in Ordely.</p>
      </header> */}
    <AvatarForm name={user.name} avatarUrl={user.avatarUrl} />
      <ProfileForm name={user.name} email={user.email} />
    </>
  );
}
