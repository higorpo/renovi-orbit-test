import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import { dispatchPaymentSentryAlerts } from "../_shared/observability/payment-sentry-matrix.ts";
import {
  handlePaymentEmitSentryAlertsRequest,
  type PaymentEmitSentryAlertsDeps,
} from "./handleRequest.ts";

function createDeps(): PaymentEmitSentryAlertsDeps {
  return {
    dispatchAlerts: (alerts) => dispatchPaymentSentryAlerts(alerts),
  };
}

servePaymentFunction("payment-emit-sentry-alerts", (req) =>
  handlePaymentEmitSentryAlertsRequest(req, createDeps()));
