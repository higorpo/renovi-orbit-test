import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import type {
  EmitSentryAlertsBody,
  EmitSentryAlertsSummary,
} from "./types.ts";

export type PaymentEmitSentryAlertsDeps = {
  dispatchAlerts: (alerts: EmitSentryAlertsBody["alerts"]) => Promise<number>;
};

function parseAlertsBody(body: unknown): EmitSentryAlertsBody["alerts"] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const alerts = (body as Record<string, unknown>).alerts;
  if (!Array.isArray(alerts)) {
    return [];
  }

  return alerts as EmitSentryAlertsBody["alerts"];
}

export async function handlePaymentEmitSentryAlertsRequest(
  req: Request,
  deps: PaymentEmitSentryAlertsDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const auth = validateOrbitCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.code }, auth.status, cors);
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  const alerts = parseAlertsBody(body);
  const dispatched = await deps.dispatchAlerts(alerts);
  const summary: EmitSentryAlertsSummary = {
    received: alerts.length,
    dispatched,
  };

  return jsonResponse(summary, 200, cors);
}
