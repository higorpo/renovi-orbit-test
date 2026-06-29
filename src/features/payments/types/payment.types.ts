import type { Database } from "@/lib/supabase/database.types";

export type PaymentGatewaySlug =
  Database["public"]["Enums"]["payment_gateway_slug"];

export type PaymentScheduleState =
  Database["public"]["Enums"]["payment_schedule_state"];

export type PaymentWebhookEventState =
  Database["public"]["Enums"]["payment_webhook_event_state"];

export type ContractedServicePaymentStatus =
  Database["public"]["Enums"]["contracted_service_status"];

/** Option A — aligned with `_shared/payment/constants.ts`. */
export const PAYMENT_GATEWAY_SLUG: PaymentGatewaySlug = "netcred";

export const SUPPORTED_PAYMENT_METHODS = ["CREDIT_CARD"] as const;

export type SupportedPaymentMethod =
  (typeof SUPPORTED_PAYMENT_METHODS)[number];
