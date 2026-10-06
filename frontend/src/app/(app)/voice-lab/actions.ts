"use server";

import { revalidatePath } from "next/cache";
import { api, type Call, type CallWithOrder } from "@/lib/api";

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
  item: string;
  quantity: number;
  total: number;
  autoDispatch?: boolean;
}): Promise<{ success: boolean; callId?: number; error?: string }> {
  try {
    const quantity = data.quantity > 0 ? data.quantity : 1;

    const order = await api.createOrder({
      customer: data.customer.trim() || "Test Customer",
      phone: data.phone.trim() || "+216 99 123 456",
      items: [
        {
          productName: data.item.trim() || "Pack Découverte Ordely",
          quantity,
        },
      ],
      total: data.total > 0 ? data.total : 49.9,
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
): Promise<{ success: boolean; call?: CallWithOrder & { attempts: number }; error?: string }> {
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
