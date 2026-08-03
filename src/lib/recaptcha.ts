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

/** Shared so concurrent preload/execute calls wait on the same script load. */
let scriptLoadPromise: Promise<void> | null = null;

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

function waitForExistingScript(existingScript: HTMLElement): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }

    const onLoad = () => resolve();
    const onError = () => reject(new Error("Falha ao carregar reCAPTCHA."));
    existingScript.addEventListener("load", onLoad, { once: true });
    existingScript.addEventListener("error", onError, { once: true });

    // load may have already fired before listeners were attached
    const intervalId = window.setInterval(() => {
      if (window.grecaptcha) {
        cleanup();
        resolve();
      }
    }, 50);
    const timeoutId = window.setTimeout(() => {
      cleanup();
      if (window.grecaptcha) resolve();
      else reject(new Error("Falha ao carregar reCAPTCHA."));
    }, 10_000);

    function cleanup() {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      existingScript.removeEventListener("load", onLoad);
      existingScript.removeEventListener("error", onError);
    }
  });
}

async function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (window.grecaptcha) return;

  const existingScript = document.getElementById(RECAPTCHA_SCRIPT_ID);
  if (existingScript) {
    await waitForExistingScript(existingScript);
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

async function ensureRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.grecaptcha) return;

  // Script removed from DOM (e.g. test cleanup) — allow a fresh load.
  if (!document.getElementById(RECAPTCHA_SCRIPT_ID)) {
    scriptLoadPromise = null;
  }

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = loadRecaptchaScript(siteKey).catch((error) => {
    scriptLoadPromise = null;
    throw error;
  });
  return scriptLoadPromise;
}

/**
 * Load reCAPTCHA early so v3 can observe page interactions before submit.
 * Google recommends against loading only at the restricted action (e.g. form submit).
 */
export async function preloadRecaptcha(): Promise<void> {
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey || typeof window === "undefined") return;

  try {
    await ensureRecaptchaScript(siteKey);
    if (!window.grecaptcha) return;

    await new Promise<void>((resolve) => {
      window.grecaptcha?.ready(() => resolve());
    });
  } catch (error) {
    logger.warn("recaptcha_preload_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
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
