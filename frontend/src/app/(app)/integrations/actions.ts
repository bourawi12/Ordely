"use server";

import { api, ApiError, type Integration } from "@/lib/api";

export interface IntegrationActionState {
  error?: string;
  success?: string;
  integration?: Integration;
  apiKey?: string;
  webhookSecret?: string;
}

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "Ordely could not complete that action.";
}

export async function createIntegration(
  _previous: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  try {
    const result = await api.createIntegration({ webhookUrl: String(formData.get("webhookUrl") ?? "").trim() || undefined });
    return { ...result, success: "Your integration is ready." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function updateIntegration(
  _previous: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  try {
    const integration = await api.updateIntegration({ webhookUrl: String(formData.get("webhookUrl") ?? "").trim() || undefined });
    return { integration, success: "Your callback address was saved." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function testIntegration(): Promise<IntegrationActionState> {
  try {
    const result = await api.testIntegration();
    return { integration: result.integration, success: "Test message sent successfully." };
  } catch (error) {
    return { error: message(error) };
  }
}