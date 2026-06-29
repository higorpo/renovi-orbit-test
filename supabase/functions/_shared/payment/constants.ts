import type { SupabaseClient } from "@supabase/supabase-js";

/** Option A — single gateway at MVP (design.md §3.1). */
export const PAYMENT_GATEWAY_SLUG = "netcred" as const;

export type PaymentGatewaySlug = typeof PAYMENT_GATEWAY_SLUG;

/** MVP payment methods; Pix/Boleto require code + migration when added. */
export const SUPPORTED_PAYMENT_METHODS = ["CREDIT_CARD"] as const;

export type SupportedPaymentMethod =
  (typeof SUPPORTED_PAYMENT_METHODS)[number];

/** Edge env var for NetCred GraphQL base URL (non-secret). */
export const NETCRED_API_BASE_URL_ENV = "NETCRED_API_BASE_URL";

/** Edge env var names for NetCred credentials consumed by payment EFs. */
export const NETCRED_ENV_SECRET_KEYS = [
  "NETCRED_USERNAME",
  "NETCRED_PASSWORD",
  "NETCRED_WEBHOOK_SECRET",
] as const;

/** @deprecated Use NETCRED_ENV_SECRET_KEYS */
export const NETCRED_VAULT_SECRET_KEYS = NETCRED_ENV_SECRET_KEYS;

export type NetCredEnvSecretKey = (typeof NETCRED_ENV_SECRET_KEYS)[number];

/** @deprecated Use NetCredEnvSecretKey */
export type NetCredVaultSecretKey = NetCredEnvSecretKey;

export function resolveNetCredApiBaseUrl(
  getEnv: (key: string) => string | undefined,
): string {
  const raw = getEnv(NETCRED_API_BASE_URL_ENV);
  const url = raw?.trim();

  if (!url) {
    throw new Error(
      `${NETCRED_API_BASE_URL_ENV} is required for NetCred adapter operations`,
    );
  }

  return url.replace(/\/+$/, "");
}

export const PAYMENT_PLATFORM_CONSTANT_KEYS = [
  "cc_visa_master_1x_rate",
  "cc_visa_master_2_6x_rate",
  "cc_visa_master_7_12x_rate",
  "cc_elo_other_1x_rate",
  "cc_elo_other_2_6x_rate",
  "cc_elo_other_7_12x_rate",
  "cc_fixed_processing_fee_brl",
  "max_charge_attempts",
  "charge_retry_interval_minutes",
  "payment_lease_duration_minutes",
  "provider_onboarding_batch_size",
  "auto_cancel_hours_before_service",
  "scheduled_charge_hours_before_service",
  "installment_hmac_expires_minutes",
  "reconciliation_poll_interval_minutes",
  "webhook_base_retry_interval_minutes",
  "payment_system_rollout_percentage",
  "charge_cron_dry_run",
] as const;

export type PaymentPlatformConstantKey =
  (typeof PAYMENT_PLATFORM_CONSTANT_KEYS)[number];

export type PlatformConstants = Record<PaymentPlatformConstantKey, number>;

export const PAYMENT_PLATFORM_CONSTANT_DEFAULTS: PlatformConstants = {
  cc_visa_master_1x_rate: 2.39,
  cc_visa_master_2_6x_rate: 2.59,
  cc_visa_master_7_12x_rate: 2.79,
  cc_elo_other_1x_rate: 2.69,
  cc_elo_other_2_6x_rate: 2.89,
  cc_elo_other_7_12x_rate: 3.19,
  cc_fixed_processing_fee_brl: 0.39,
  max_charge_attempts: 3,
  charge_retry_interval_minutes: 30,
  payment_lease_duration_minutes: 10,
  provider_onboarding_batch_size: 50,
  auto_cancel_hours_before_service: 12,
  scheduled_charge_hours_before_service: 48,
  installment_hmac_expires_minutes: 10,
  reconciliation_poll_interval_minutes: 30,
  webhook_base_retry_interval_minutes: 5,
  payment_system_rollout_percentage: 0,
  charge_cron_dry_run: 1,
};

type PlatformConstantRow = {
  key: string;
  value: unknown;
};

export type WarnFn = (event: string, context?: Record<string, unknown>) => void;

export function parseNumericConstant(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getConstantWithFallback(
  byKey: ReadonlyMap<string, unknown>,
  key: PaymentPlatformConstantKey,
  fallback: number,
  warn: WarnFn = () => {},
): number {
  if (!byKey.has(key)) {
    warn("platform_constant_missing", { key, fallback });
    return fallback;
  }

  const parsed = parseNumericConstant(byKey.get(key));
  if (parsed === null) {
    warn("platform_constant_missing", { key, fallback, reason: "invalid_value" });
    return fallback;
  }

  return parsed;
}

export function resolvePaymentPlatformConstants(
  rows: PlatformConstantRow[],
  warn: WarnFn = () => {},
): PlatformConstants {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const resolved = { ...PAYMENT_PLATFORM_CONSTANT_DEFAULTS };

  for (const key of PAYMENT_PLATFORM_CONSTANT_KEYS) {
    resolved[key] = getConstantWithFallback(
      byKey,
      key,
      PAYMENT_PLATFORM_CONSTANT_DEFAULTS[key],
      warn,
    );
  }

  return resolved;
}

export async function loadPaymentPlatformConstants(
  supabase: SupabaseClient,
  warn: WarnFn = () => {},
): Promise<PlatformConstants> {
  const { data, error } = await supabase
    .from("platform_constants")
    .select("key, value")
    .in("key", [...PAYMENT_PLATFORM_CONSTANT_KEYS]);

  if (error) {
    throw new Error(error.message);
  }

  return resolvePaymentPlatformConstants(data ?? [], warn);
}

export function parseChargeCronDryRun(value: unknown): boolean {
  if (value === true || value === "true") {
    return true;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}
