"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ApiError, api } from "@/lib/api";

export interface ReclamationFormState {
  error?: string;
}

export async function createReclamation(
  _prev: ReclamationFormState,
  formData: FormData,
): Promise<ReclamationFormState> {
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const orderIdValue = String(formData.get("orderId") ?? "").trim();
  const orderId = orderIdValue ? Number(orderIdValue) : undefined;

  if (!subject || !description) return { error: "Subject and description are required." };
  if (orderIdValue && (orderId === undefined || !Number.isInteger(orderId) || orderId < 1)) {
    return { error: "Order reference must be a positive number." };
  }

  try {
    await api.createReclamation({ subject, description, ...(orderId ? { orderId } : {}) });
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof ApiError ? err.message : "Backend unreachable" };
  }
  revalidatePath("/reclamations");
  redirect("/reclamations");
}