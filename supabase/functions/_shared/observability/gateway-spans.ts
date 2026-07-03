import { emitFailedPermanentTransitionWarning } from "./payment-sentry-matrix.ts";
import { withSpan } from "../sentrySpans.ts";

export { emitFailedPermanentTransitionWarning };

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
