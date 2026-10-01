import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AvatarForm } from "./avatar-form";
import { ProfileForm } from "./settings-forms";
import { ShopAgentForm, ShopDetailsForm, ShopIdentityForm } from "./shop-forms";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile settings — Ordely" };

export default async function ProfileSettingsPage() {
  const [user, boutique] = await Promise.all([api.me(), api.boutique()]);

  return (
    <>
      {/*  <header className={styles.pageHead}>
        <h2>Profile</h2>
        <p>How you appear in Ordely.</p>
      </header> */}
      <AvatarForm name={user.name} avatarUrl={user.avatarUrl} />
      <ProfileForm name={user.name} email={user.email} />
      <ShopIdentityForm boutique={boutique} />
      <ShopAgentForm boutique={boutique} />
      <ShopDetailsForm boutique={boutique} />
    </>
  );
}
