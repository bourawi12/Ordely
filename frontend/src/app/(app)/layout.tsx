import AppShell from "@/components/app/AppShell";
import { api } from "@/lib/api";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // api.me() redirects to /login if the session is missing or expired.
  const [user, usage] = await Promise.all([api.me(), api.usage().catch(() => null)]);

  return (
    <AppShell user={user} usage={usage}>
      {children}
    </AppShell>
  );
}
