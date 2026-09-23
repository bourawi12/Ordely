"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export interface QueueState {
  error?: string;
  message?: string;
}

function refresh(orderId?: number) {
  revalidatePath("/dashboard");
  revalidatePath("/call-logs");
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

export async function queueCall(orderId: number): Promise<QueueState> {
  try {
    await api.queueCall(orderId);
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof ApiError ? err.message : "Could not queue the call" };
  }
  refresh(orderId);
  return { message: "Call queued" };
}

export async function queueAllPending(): Promise<QueueState> {
  try {
    const { queued } = await api.queueAllPending();
    refresh();
    return {
      message: queued ? `${queued} call${queued > 1 ? "s" : ""} queued` : "Every pending order already has a call queued",
    };
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof ApiError ? err.message : "Could not queue calls" };
  }
}
