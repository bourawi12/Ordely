"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export interface SettingsActionState {
  error?: string;
  success?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.status === 429
      ? "Trop de tentatives. Veuillez patienter une minute avant de réessayer."
      : err.message;
  }
  return fallback;
}

export async function updateProfile(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Le nom ne peut pas être vide." };
  }

  try {
    await api.updateProfile({ name });
    revalidatePath("/settings");
    return { success: "Votre nom a été mis à jour avec succès." };
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Impossible de mettre à jour le profil.") };
  }
}

export async function changePassword(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return { error: "Veuillez renseigner votre mot de passe actuel." };
  }

  if (newPassword.length < 8) {
    return { error: "Le nouveau mot de passe doit comporter au moins 8 caractères." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "La confirmation du mot de passe ne correspond pas." };
  }

  try {
    await api.changePassword({ currentPassword, newPassword });
    return { success: "Votre mot de passe a été modifié avec succès." };
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Impossible de modifier le mot de passe.") };
  }
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Sends the chosen picture to the API, which checks the real file type and stores it in MinIO. */
export async function uploadAvatar(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisissez une image à envoyer." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { error: "L'image dépasse 2 Mo." };
  }
  if (!AVATAR_TYPES.includes(file.type)) {
    return { error: "Format non pris en charge. Utilisez une image JPEG, PNG ou WebP." };
  }

  const body = new FormData();
  body.append("file", file, file.name);
  try {
    await api.uploadAvatar(body);
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Impossible d'enregistrer la photo.") };
  }
  // The header avatar lives in the app layout.
  revalidatePath("/", "layout");
  return { success: "Votre photo de profil a été mise à jour." };
}

export async function removeAvatar(): Promise<SettingsActionState> {
  try {
    await api.removeAvatar();
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Impossible de supprimer la photo.") };
  }
  revalidatePath("/", "layout");
  return { success: "Votre photo de profil a été supprimée." };
}
