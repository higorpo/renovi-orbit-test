import type { OrbitSentryAlertItem } from "../_shared/observability/generic-sentry-alerts.ts";

export type EmitSentryAlertsBody = {
  alerts: OrbitSentryAlertItem[];
};

export type EmitSentryAlertsSummary = {
  received: number;
  dispatched: number;
};
