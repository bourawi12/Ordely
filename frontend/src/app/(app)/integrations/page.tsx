import { api } from "@/lib/api";
import IntegrationSetup from "./IntegrationSetup";

export default async function IntegrationsPage() {
  const integration = await api.getIntegration();
  return <IntegrationSetup initialIntegration={integration} />;
}
