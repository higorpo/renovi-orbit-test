export type RecaptchaAction =
  | "client_signup_submit"
  | "provider_signup_submit"
  | "request_quote_submit";

const MIN_RECAPTCHA_SCORE = 0.5;
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export interface RecaptchaValidationResult {
  success: boolean;
  message?: string;
  skipped?: boolean;
}

interface GoogleRecaptchaResponse {
  success?: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

export async function validateRecaptchaToken(
  token: string,
  action: RecaptchaAction
): Promise<RecaptchaValidationResult> {
  const secret = Deno.env.get("RECAPTCHA_SECRET_KEY");
  if (!secret) {
    console.warn("[recaptcha] RECAPTCHA_SECRET_KEY not configured; skipping validation.");
    return { success: true, skipped: true };
  }

  if (!token || !token.trim()) {
    return { success: false, message: "Token do reCAPTCHA ausente." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    return { success: false, message: "Falha ao verificar reCAPTCHA." };
  }

  const data = (await res.json()) as GoogleRecaptchaResponse;
  if (!data.success) {
    return {
      success: false,
      message: `reCAPTCHA inválido (${(data["error-codes"] ?? []).join(", ") || "sem detalhes"}).`,
    };
  }

  if (typeof data.action === "string" && data.action !== action) {
    return { success: false, message: "Ação de reCAPTCHA inválida." };
  }

  if (typeof data.score === "number" && data.score < MIN_RECAPTCHA_SCORE) {
    return { success: false, message: "reCAPTCHA com score insuficiente." };
  }

  return { success: true };
}
