"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError, type OrderStatus } from "@/lib/api";

export interface FormState {
  error?: string;
  success?: string;
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

/** The edit form on the order page. `id` is bound by the page. */
export async function editOrder(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api.updateOrder(id, {
      customer: String(formData.get("customer") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      item: String(formData.get("item") ?? ""),
      quantity: Number(formData.get("quantity")),
      total: Number(formData.get("total")),
    });
  } catch (err) {
    unstable_rethrow(err);
    return {
      error: err instanceof ApiError ? err.message : "Backend unreachable",
    };
  }
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath(`/orders/${id}`);
  return { success: "Order saved." };
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

export interface ImportState {
  error?: string;
  imported?: number;
  failed?: number;
  errors?: { row: number; message: string }[];
}

export async function importOrders(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Please select a CSV file." };
  }

  try {
    const form = new FormData();
    form.append("file", file);
    const result = await api.importOrders(form);
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return {
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
    };
  } catch (err) {
    unstable_rethrow(err);
    return {
      error: err instanceof ApiError ? err.message : "Backend unreachable",
    };
  }
}

