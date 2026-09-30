import type { Metadata } from "next";
import RegisterFlow from "@/components/RegisterFlow";

export const metadata: Metadata = { title: "Créer un compte — Ordely" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <RegisterFlow next={next} />;
}
