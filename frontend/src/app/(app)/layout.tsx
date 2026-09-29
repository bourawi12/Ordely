import { redirect } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { api } from "@/lib/api";
import { stepHref } from "@/lib/onboarding";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // api.me() redirects to /login if the session is missing or expired.
  const [user, boutique, usage] = await Promise.all([
    api.me(),
    api.boutique(),
    api.usage().catch(() => null),
  ]);

  // The app stays closed until the boutique's onboarding is done.
  if (!boutique.onboarding.completed) {
    redirect(stepHref(boutique.onboarding.nextStep));
  }

  return (
    <AppShell user={user} usage={usage}>
      {children}
    </AppShell>
  );
}
