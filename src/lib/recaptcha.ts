import { getSupabaseAnonKey } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export type RecaptchaAction =
  | "client_signup_submit"
  | "provider_signup_submit"
  | "request_quote_submit";

interface RecaptchaVerifyResponse {
  success?: boolean;
  message?: string;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: RecaptchaAction }
      ) => Promise<string>;
    };
  }
}

const RECAPTCHA_SCRIPT_ID = "google-recaptcha-script";

function getRecaptchaSiteKey(): string | null {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  return typeof siteKey === "string" && siteKey.trim().length > 0
    ? siteKey.trim()
    : null;
}

function getSupabaseFunctionsUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (typeof url !== "string" || !url) {
    throw new Error("VITE_SUPABASE_URL is not set");
  }
  return `${url.replace(/\/$/, "")}/functions/v1`;
}

async function ensureRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.grecaptcha) return;

  const existingScript = document.getElementById(RECAPTCHA_SCRIPT_ID);
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar reCAPTCHA.")),
        { once: true }
      );
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar reCAPTCHA."));
    document.head.appendChild(script);
  });
}

export async function executeRecaptcha(action: RecaptchaAction): Promise<string | null> {
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey) return null;
  if (typeof window === "undefined") return null;

  try {
    await ensureRecaptchaScript(siteKey);
    if (!window.grecaptcha) return null;

    const token = await new Promise<string>((resolve, reject) => {
      window.grecaptcha?.ready(async () => {
        try {
          const value = await window.grecaptcha?.execute(siteKey, { action });
          if (!value) {
            reject(new Error("Token do reCAPTCHA não retornado."));
            return;
          }
          resolve(value);
        } catch (error) {
          reject(error);
        }
      });
    });

    return token;
  } catch (error) {
    logger.warn("recaptcha_execute_failed", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function verifyRecaptchaToken(
  token: string,
  action: RecaptchaAction
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${getSupabaseFunctionsUrl()}/verify-recaptcha`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getSupabaseAnonKey()}`,
      },
      body: JSON.stringify({ token, action }),
    });

    const data = (await response.json().catch(() => ({}))) as RecaptchaVerifyResponse;
    if (!response.ok) {
      return {
        success: false,
        message: data.message ?? "Não foi possível validar o reCAPTCHA.",
      };
    }
    return { success: data.success === true, message: data.message };
  } catch (error) {
    logger.error("recaptcha_verify_failed", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      message: "Não foi possível validar o reCAPTCHA.",
    };
  }
}
