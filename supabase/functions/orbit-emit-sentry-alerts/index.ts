import { serve } from "std/http/server";
import { initSentryEdge } from "../_shared/sentrySpans.ts";
import { dispatchOrbitSentryAlerts } from "../_shared/observability/generic-sentry-alerts.ts";
import {
  handleOrbitEmitSentryAlertsRequest,
  type OrbitEmitSentryAlertsDeps,
} from "./handleRequest.ts";

function createDeps(): OrbitEmitSentryAlertsDeps {
  return {
    dispatchAlerts: (alerts) => dispatchOrbitSentryAlerts(alerts),
  };
}

serve(async (req) => {
  await initSentryEdge("orbit-emit-sentry-alerts");
  return handleOrbitEmitSentryAlertsRequest(req, createDeps());
});
