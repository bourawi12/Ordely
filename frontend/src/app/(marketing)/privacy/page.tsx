import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy — Ordely",
  description: "Privacy Policy for the Ordely platform explaining how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
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
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.meta}>
          Version 1.0 &middot; Last updated: October 6, 2026
        </p>

        <div className={styles.content}>
          <h2>1. Information We Collect</h2>
          <p>
            When you register for and use Ordely, we collect personal and business information necessary to operate our service, including:
          </p>
          <ul>
            <li>Your name, email address, and account preferences.</li>
            <li>Store and order data provided for order verification.</li>
            <li>Call transcripts and execution logs generated during automated confirmation calls.</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use collected data solely to deliver, improve, and secure the Ordely service. Specifically:
          </p>
          <ul>
            <li>To execute automated phone calls and verify order details.</li>
            <li>To provide analytics and reporting on your store&apos;s performance.</li>
            <li>To send account notifications, security updates, and verification emails.</li>
          </ul>

          <h2>3. Data Protection &amp; Security</h2>
          <p>
            We implement strict technical and organizational security measures to safeguard your data against unauthorized access, loss, or alteration. All data in transit is encrypted using standard TLS protocol.
          </p>

          <h2>4. Data Sharing &amp; Third Parties</h2>
          <p>
            Ordely does not sell or rent your personal data to third parties. We share data only with necessary service providers (such as hosting, email delivery, and telephony providers) under strict confidentiality agreements.
          </p>

          <h2>5. Your Rights</h2>
          <p>
            You have the right to access, update, or request deletion of your personal information stored with Ordely. You can update your profile directly in settings or contact support for data requests.
          </p>

          <h2>6. Updates to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically to reflect changes in legal or operational practices. The updated version will be posted here with an updated effective date.
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} Ordely. All rights reserved.
      </footer>
    </div>
  );
}
