import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms & Conditions — Ordely",
  description: "Terms and Conditions of Service for using the Ordely platform.",
};

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <Logo />
        </Link>
        <Link href="/register" className={styles.backLink}>
          &larr; Back to Signup
        </Link>
      </header>

      <main className={styles.container}>
        <h1 className={styles.title}>Terms &amp; Conditions</h1>
        <p className={styles.meta}>
          Version 1.0 &middot; Last updated: October 6, 2026
        </p>

        <div className={styles.content}>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account or accessing the Ordely platform, you agree to be bound by these Terms &amp; Conditions and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this service.
          </p>

          <h2>2. Account Creation &amp; Responsibilities</h2>
          <p>
            To use Ordely, you must create an account by providing accurate, complete, and current information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </p>
          <ul>
            <li>You agree to provide accurate business and contact information.</li>
            <li>You agree to use Ordely responsibly and in compliance with all relevant laws.</li>
            <li>You must not use the service for unauthorized or unlawful automated messaging or calls.</li>
          </ul>

          <h2>3. Service Description &amp; Fair Use</h2>
          <p>
            Ordely provides automated phone confirmation and order management services for e-commerce merchants. We reserve the right to modify, suspend, or discontinue any aspect of the service at any time.
          </p>

          <h2>4. Intellectual Property</h2>
          <p>
            All materials contained on the Ordely platform, including software, design, branding, and proprietary algorithms, are the property of Ordely and are protected by applicable intellectual property rights.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            Ordely is provided on an &quot;as is&quot; and &quot;as available&quot; basis. In no event shall Ordely or its providers be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use the service.
          </p>

          <h2>6. Changes to Terms</h2>
          <p>
            We reserve the right to revise these Terms &amp; Conditions at any time. Continued use of the platform following any modifications constitutes acceptance of the updated terms.
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} Ordely. All rights reserved.
      </footer>
    </div>
  );
}
