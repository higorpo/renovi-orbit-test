import { serve } from "std/http/server";
import { initSentryEdge, withSpan } from "../sentrySpans.ts";

export type PaymentTransactionContext = {
  service_id?: string;
  gateway_slug?: string;
};

export function getPaymentEnvironment(): string {
  return Deno.env.get("ENVIRONMENT") ?? Deno.env.get("ENV") ?? "edge";
}

export async function initPaymentObservability(functionName: string): Promise<void> {
  await initSentryEdge(functionName);
}

export async function withPaymentTransaction<T>(
  functionName: string,
  context: PaymentTransactionContext,
  handler: () => Promise<T>,
): Promise<T> {
  await initPaymentObservability(functionName);

  return withSpan(
    functionName,
    "payment.function",
    {
      environment: getPaymentEnvironment(),
      gateway_slug: context.gateway_slug ?? "netcred",
      service_id: context.service_id,
    },
    handler,
  );
}

export function servePaymentFunction(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
  options?: {
    gatewaySlug?: string;
    resolveContext?: (
      req: Request,
    ) => Promise<PaymentTransactionContext> | PaymentTransactionContext;
  },
): void {
  serve(async (req) => {
    const resolvedContext = options?.resolveContext
      ? await options.resolveContext(req)
      : {};

    return withPaymentTransaction(functionName, {
      gateway_slug: options?.gatewaySlug ?? "netcred",
      ...resolvedContext,
    }, () => handler(req));
  });
}
