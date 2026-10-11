"use server";

import { api } from "@/lib/api";
import { customApiOrdersEndpoint } from "@/lib/integration-endpoints";

export async function createCustomApiKey() {
  const result = await api.createCustomApiIntegration("Custom website API");
  const apiBase =
    process.env.ORDELY_PUBLIC_API_URL ??
    process.env.BACKEND_URL ??
    "http://localhost:3001/api";

  return {
    apiKey: result.apiKey,
    endpoint: customApiOrdersEndpoint(apiBase),
    warning: result.warning,
  };
}

export async function saveCustomApiWebhookUrl(webhookUrl: string) {
  return api.updateCustomApiIntegration({ webhookUrl });
}

export async function generateCustomApiWebhookSecret() {
  return api.updateCustomApiIntegration({ rotateWebhookSecret: true });
}