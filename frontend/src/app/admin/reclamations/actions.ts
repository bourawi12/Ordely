"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ApiError, type ReclamationStatus } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";

export async function updateReclamationStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as ReclamationStatus;
  try {
    await adminApi.updateReclamationStatus(id, status);
  } catch (err) {
    unstable_rethrow(err);
    throw new Error(err instanceof ApiError ? err.message : "Backend unreachable");
  }
  revalidatePath("/admin/reclamations");
  revalidatePath(`/admin/reclamations/${id}`);
  redirect(`/admin/reclamations/${id}`);
}