"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError, type OrderStatus } from "@/lib/api";

export interface FormState {
  error?: string;
}

export async function createOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api.createOrder({
      customer: String(formData.get("customer") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      item: String(formData.get("item") ?? ""),
      quantity: Number(formData.get("quantity")),
      total: Number(formData.get("total")),
    });
  } catch (err) {
    // Let the "session expired" redirect through instead of showing it as an error.
    unstable_rethrow(err);
    return {
      error: err instanceof ApiError ? err.message : "Backend unreachable",
    };
  }
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return {};
}

export async function setOrderStatus(id: number, status: OrderStatus) {
  await api.updateOrder(id, { status });
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath(`/orders/${id}`);
}

export async function deleteOrder(id: number) {
  await api.deleteOrder(id);
  revalidatePath("/orders");
  redirect("/orders");
}
