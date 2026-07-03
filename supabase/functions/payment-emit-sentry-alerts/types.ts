import type { PaymentSentryAlert } from "../_shared/observability/payment-sentry-matrix.ts";

export type EmitSentryAlertsBody = {
  alerts: PaymentSentryAlert[];
};

export type EmitSentryAlertsSummary = {
  received: number;
  dispatched: number;
};
