"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError, type AuthResult } from "@/lib/api";
import { clearSession, safeNextPath, setSession } from "@/lib/session";

export interface AuthFormState {
  error?: string;
  email?: string;
  name?: string;
}

async function startSession(result: AuthResult, next: FormDataEntryValue | null) {
  await setSession(result.accessToken, result.expiresIn);
  redirect(safeNextPath(next));
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

  if (password !== String(formData.get("confirm") ?? "")) {
    return { error: "Passwords do not match.", email, name };
  }

  try {
    const result = await api.register({ email, name, password });
    await startSession(result, formData.get("next"));
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
