import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "@/components/onboarding/onboarding.module.css";

export const metadata = { title: "Configurer ma boutique — Ordely" };

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <Link href="/" className={styles.logo}>
          <Logo />
        </Link>
        {children}
      </div>
    </div>
  );
}
