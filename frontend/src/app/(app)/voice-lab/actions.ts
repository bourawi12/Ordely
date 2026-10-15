"use server";

import { revalidatePath } from "next/cache";
import { api, type Call, type CallDetail } from "@/lib/api";

export async function dispatchCallAction(callId: number): Promise<{ success: boolean; call?: Call; error?: string }> {
  try {
    const call = await api.dispatchCall(callId);
    revalidatePath("/voice-lab");
    revalidatePath("/call-logs");
    return { success: true, call };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to dispatch call";
    return { success: false, error: message };
  }
}

export async function queueCallForOrderAction(orderId: number): Promise<{ success: boolean; call?: Call; error?: string }> {
  try {
    const call = await api.queueCall(orderId);
    revalidatePath("/voice-lab");
    return { success: true, call };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to queue call";
    return { success: false, error: message };
  }
}

export async function createTestOrderAndQueueAction(data: {
  customer: string;
  phone: string;
  items: { productName: string; quantity: number; unitPrice: number }[];
  autoDispatch?: boolean;
}): Promise<{ success: boolean; callId?: number; error?: string }> {
  try {
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.some((item) =>
      !item || typeof item.productName !== "string" || !item.productName.trim() ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000 ||
      !Number.isFinite(item.unitPrice) || item.unitPrice < 0,
    )) {
      return { success: false, error: "Add valid product names, quantities, and prices." };
    }

    const items = data.items.map((item) => ({
      ...item,
      productName: item.productName.trim(),
      unitPrice: Math.round(item.unitPrice * 1000) / 1000,
    }));
    const total = items.reduce(
      (sum, item) => sum + Math.round(item.unitPrice * 1000) * item.quantity,
      0,
    ) / 1000;

    const order = await api.createOrder({
      customer: data.customer.trim() || "Test Customer",
      phone: data.phone.trim() || "+216 99 123 456",
      items,
      total,
    });

    const call = await api.queueCall(order.id);

    if (data.autoDispatch) {
      await api.dispatchCall(call.id);
    }

    revalidatePath("/voice-lab");
    return { success: true, callId: call.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create test order";
    return { success: false, error: message };
  }
}

export async function getCallDetailsAction(
  callId: number,
): Promise<{ success: boolean; call?: CallDetail; error?: string }> {
  try {
    const call = await api.getCall(callId);
    return { success: true, call };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch call details";
    return { success: false, error: message };
  }
}

export async function getRecordingUrlAction(
  callId: number,
  speaker: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const res = await api.getRecordingUrl(callId, speaker);
    return { success: true, url: res.url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get recording URL";
    return { success: false, error: message };
  }
}
