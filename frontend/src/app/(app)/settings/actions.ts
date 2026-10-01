"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { api, ApiError, type BoutiqueSection } from "@/lib/api";
import { isStrongPassword } from "@/lib/password";
import { HEX_COLOR, THEME_MODES, type ThemeMode } from "@/lib/theme";

export interface SettingsActionState {
  error?: string;
  success?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.status === 429
      ? "Too many attempts. Please wait a minute and try again."
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
    return { error: "Your name can't be empty." };
  }

  try {
    await api.updateProfile({ name });
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Could not update your profile.") };
  }
  // The name also shows in the header and the settings menu.
  revalidatePath("/", "layout");
  return { success: "Name saved." };
}

export async function updateAppearance(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  // An empty colour means the Ordely blue.
  const accent = String(formData.get("accentColor") ?? "");
  const theme = String(formData.get("themeMode") ?? "");
  if (
    (accent && !HEX_COLOR.test(accent)) ||
    !THEME_MODES.includes(theme as ThemeMode)
  ) {
    return { error: "Pick a theme and a valid colour." };
  }

  try {
    await api.updateAppearance({
      accentColor: accent || null,
      themeMode: theme as ThemeMode,
    });
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Could not save your appearance.") };
  }
  // The app layout applies the theme and the colour.
  revalidatePath("/", "layout");
  return { success: "Appearance saved." };
}

export async function changePassword(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return { error: "Enter your current password." };
  }
  if (!isStrongPassword(newPassword)) {
    return {
      error:
        "Your new password needs at least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character.",
    };
  }
  if (newPassword !== confirmPassword) {
    return { error: "The two new passwords don't match." };
  }

  try {
    await api.changePassword({ currentPassword, newPassword });
    return { success: "Password updated." };
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Could not change your password.") };
  }
}

/** Emails the signed-in user a link to choose a new password (when the current one is lost). */
export async function sendResetLink(): Promise<SettingsActionState> {
  try {
    const { email } = await api.me();
    await api.forgotPassword(email);
    return { success: `Link sent to ${email}. It works for 1 hour.` };
  } catch (err) {
    unstable_rethrow(err);
    return {
      error: errorMessage(
        err,
        "Could not send the email. Try again in a few minutes.",
      ),
    };
  }
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * The profile picture form: `intent=remove` deletes the picture, anything else sends the chosen
 * file to the API, which checks the real file type and stores it in MinIO.
 */
export async function saveAvatar(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return formData.get("intent") === "remove"
    ? removeAvatar()
    : uploadAvatar(formData);
}

async function uploadAvatar(formData: FormData): Promise<SettingsActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { error: "The image is larger than 2 MB." };
  }
  if (!AVATAR_TYPES.includes(file.type)) {
    return { error: "Unsupported format. Use a JPEG, PNG or WebP image." };
  }

  const body = new FormData();
  body.append("file", file, file.name);
  try {
    await api.uploadAvatar(body);
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Could not save the picture.") };
  }
  // The header avatar lives in the app layout.
  revalidatePath("/", "layout");
  return { success: "Profile picture updated." };
}

async function removeAvatar(): Promise<SettingsActionState> {
  try {
    await api.removeAvatar();
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Could not remove the picture.") };
  }
  revalidatePath("/", "layout");
  return { success: "Profile picture removed." };
}

export interface ShopActionState extends SettingsActionState {
  /** What the merchant typed, sent back so a refused save loses nothing. */
  values?: Record<string, string | string[] | undefined>;
}

async function saveShop(
  section: BoutiqueSection,
  values: NonNullable<ShopActionState["values"]>,
  success: string,
): Promise<ShopActionState> {
  try {
    await api.updateBoutique(section, values);
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err, "Could not save your shop."), values };
  }
  revalidatePath("/settings");
  return { success };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | undefined {
  return text(formData, key) || undefined;
}

export async function updateShopIdentity(
  _prev: ShopActionState,
  formData: FormData,
) {
  return saveShop(
    "identity",
    {
      name: text(formData, "name"),
      businessPhone: text(formData, "businessPhone"),
      platform: text(formData, "platform"),
    },
    "Shop saved.",
  );
}

export async function updateShopAgent(
  _prev: ShopActionState,
  formData: FormData,
) {
  return saveShop(
    "agent",
    {
      callLanguages: formData.getAll("callLanguages").map(String),
      callStartTime: text(formData, "callStartTime"),
      callEndTime: text(formData, "callEndTime"),
      confirmationProcess: optional(formData, "confirmationProcess"),
    },
    "Call agent saved.",
  );
}

export async function updateShopDetails(
  _prev: ShopActionState,
  formData: FormData,
) {
  return saveShop(
    "details",
    {
      sector: optional(formData, "sector"),
      deliveryZones: formData.getAll("deliveryZones").map(String),
      dailyOrderVolume: optional(formData, "dailyOrderVolume"),
      acquisitionSource: optional(formData, "acquisitionSource"),
      carrier: optional(formData, "carrier"),
    },
    "Business details saved.",
  );
}
