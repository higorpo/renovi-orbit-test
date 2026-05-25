import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutDispatchDto } from "./types.ts";
import { DEFAULT_CHECKOUT_LIMIT, MAX_CHECKOUT_LIMIT } from "./constants.ts";

export function clampCheckoutLimit(limit: number | undefined): number {
  if (limit == null || Number.isNaN(limit)) return DEFAULT_CHECKOUT_LIMIT;
  return Math.min(MAX_CHECKOUT_LIMIT, Math.max(1, Math.floor(limit)));
}

export function parseCheckoutBatch(data: unknown): CheckoutDispatchDto[] {
  if (!Array.isArray(data)) return [];
  return data as CheckoutDispatchDto[];
}

/** Calls message_dispatcher_checkout_batch via PostgREST (task 55). */
export async function checkoutBatch(
  supabase: SupabaseClient,
  workerId: string,
  limit = DEFAULT_CHECKOUT_LIMIT,
): Promise<{ items: CheckoutDispatchDto[]; error: Error | null }> {
  const pLimit = clampCheckoutLimit(limit);

  const { data, error } = await supabase.schema("message_dispatcher").rpc(
    "message_dispatcher_checkout_batch",
    { p_limit: pLimit, p_worker_id: workerId },
  );

  if (error) {
    return { items: [], error: new Error(error.message) };
  }

  return { items: parseCheckoutBatch(data), error: null };
}
