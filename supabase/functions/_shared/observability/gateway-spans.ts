import { withSpan } from "../sentrySpans.ts";

export type GatewaySpanAttributes = Record<
  string,
  string | number | boolean | undefined
>;

export type GatewaySpanRecord = {
  operation: string;
  gateway_slug: string;
  gateway_latency_ms: number;
  outcome: "success" | "error" | "gateway_error";
  attributes: GatewaySpanAttributes;
};

let testSpanRecorder: ((record: GatewaySpanRecord) => void) | null = null;

export function setGatewaySpanRecorderForTests(
  recorder: ((record: GatewaySpanRecord) => void) | null,
): void {
  testSpanRecorder = recorder;
}

export async function withGatewaySpan<T>(
  operation: string,
  gatewaySlug: string,
  fn: () => Promise<T>,
  mapAttributes?: (result: T) => GatewaySpanAttributes,
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const latencyMs = Math.round(performance.now() - start);
    const mapped = mapAttributes?.(result) ?? {};
    const outcome = mapped.outcome === "gateway_error"
      ? "gateway_error"
      : "success";
    const attributes: GatewaySpanAttributes = {
      gateway_slug: gatewaySlug,
      operation,
      gateway_latency_ms: latencyMs,
      outcome,
      ...mapped,
    };

    testSpanRecorder?.({
      operation,
      gateway_slug: gatewaySlug,
      gateway_latency_ms: latencyMs,
      outcome,
      attributes,
    });

    await withSpan(
      `gateway.${operation}`,
      "payment.gateway",
      attributes,
      async () => undefined,
    );

    return result;
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const attributes: GatewaySpanAttributes = {
      gateway_slug: gatewaySlug,
      operation,
      gateway_latency_ms: latencyMs,
      outcome: "error",
      error_message: error instanceof Error ? error.message : String(error),
    };

    testSpanRecorder?.({
      operation,
      gateway_slug: gatewaySlug,
      gateway_latency_ms: latencyMs,
      outcome: "error",
      attributes,
    });

    await withSpan(
      `gateway.${operation}`,
      "payment.gateway",
      attributes,
      async () => undefined,
    );

    throw error;
  }
}

export async function emitFailedPermanentTransitionWarning(input: {
  service_id: string;
  schedule_id: string;
  gateway_slug?: string;
  failure_codes: string[];
}): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN")?.trim();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/deno");
    Sentry.captureMessage("payment_schedule_failed_permanent", {
      level: "warning",
      tags: {
        service_id: input.service_id,
        schedule_id: input.schedule_id,
        gateway_slug: input.gateway_slug ?? "netcred",
      },
      extra: {
        failure_codes: input.failure_codes,
      },
    });
  } catch {
    // Sentry unavailable — non-blocking.
  }
}
