import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "./auth.module.css";

export default function AuthLayout({
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
        <div className={styles.card}>{children}</div>
        <p className={styles.tagline}>Vos commandes. Confirmées.</p>
      </div>
    </div>
  );
}
