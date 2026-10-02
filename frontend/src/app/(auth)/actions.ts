"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError, type AuthResult } from "@/lib/api";
import { isStrongPassword } from "@/lib/password";
import { clearSession, safeNextPath, setSession } from "@/lib/session";
import { HEX_COLOR, THEME_MODES, type ThemeMode } from "@/lib/theme";

export interface AuthFormState {
  error?: string;
  email?: string;
  name?: string;
}

async function startSession(
  result: AuthResult,
  next: FormDataEntryValue | null,
  fallback = "/dashboard",
) {
  await setSession(result.accessToken, result.expiresIn);
  redirect(safeNextPath(next, fallback));
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 429
      ? "Too many attempts. Please wait a minute and try again."
      : err.message;
  }
  return "Could not reach the server. Please try again.";
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  try {
    const result = await api.login({
      email,
      password: String(formData.get("password") ?? ""),
    });
    await startSession(result, formData.get("next"));
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err), email };
  }
  return {};
}

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!isStrongPassword(password)) {
    return {
      error:
        "Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.",
      email,
      name,
    };
  }
  if (password !== String(formData.get("confirm") ?? "")) {
    return { error: "Passwords do not match.", email, name };
  }

  // Look chosen on the first sign-up screen; anything unexpected falls back to the defaults.
  const accent = String(formData.get("accentColor") ?? "");
  const theme = String(formData.get("themeMode") ?? "");
  const avatar = formData.get("avatar");

  try {
    const result = await api.register({
      email,
      name,
      password,
      accentColor: HEX_COLOR.test(accent) ? accent : undefined,
      themeMode: THEME_MODES.includes(theme as ThemeMode)
        ? (theme as ThemeMode)
        : undefined,
    });
    if (avatar instanceof File && avatar.size > 0) {
      // The account exists either way: a refused picture can be added later in Settings.
      const upload = new FormData();
      upload.set("file", avatar);
      await api.uploadAvatar(upload, result.accessToken).catch(() => undefined);
    }
    // A new account first confirms its email address, then goes through the onboarding.
    await startSession(result, null, "/verify-email");
  } catch (err) {
    unstable_rethrow(err);
    return { error: errorMessage(err), email, name };
  }
  return {};
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
