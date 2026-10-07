import { api } from "@/lib/api";
import VoiceTestApp from "./VoiceTestApp";

export const dynamic = "force-dynamic";

export default async function VoiceTestPage() {
  const orders = await api.listVoiceOrders();
  return <VoiceTestApp initialOrders={orders} />;
}
