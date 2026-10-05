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
    const rawItemsJson = formData.get("itemsJson");
    let items: { productName: string; quantity: number; unitPrice?: number }[] = [];

    if (rawItemsJson && typeof rawItemsJson === "string") {
      try {
        items = JSON.parse(rawItemsJson);
      } catch {
        // Fallback to single fields
      }
    }

    if (items.length === 0) {
      const item = String(formData.get("item") ?? "").trim();
      const quantity = Number(formData.get("quantity") ?? 1);
      const unitPrice = Number(formData.get("unitPrice") ?? 0);
      if (item) {
        items = [{ productName: item, quantity, unitPrice }];
      }
    }

    if (items.length === 0) {
      return { error: "Please add at least one product item." };
    }

    const totalRaw = formData.get("total");
    const total = totalRaw ? Number(totalRaw) : undefined;

    await api.createOrder({
      customer: String(formData.get("customer") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      items,
      total,
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
    const totalRaw = formData.get("total");
    await api.updateOrder(id, {
      customer: String(formData.get("customer") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      total: totalRaw ? Number(totalRaw) : undefined,
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

