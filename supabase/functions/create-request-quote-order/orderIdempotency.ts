import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../_shared/database.types.ts";
import type { CreateOrderSuccess, ParsedFormData } from "./types.ts";

export const REQUEST_QUOTE_CREATE_ORDER_OPERATION = "request_quote.create_order";

export function photoMeta(photoFiles: Blob[]): { count: number; totalBytes: number } {
  return {
    count: photoFiles.length,
    totalBytes: photoFiles.reduce((sum, file) => sum + file.size, 0),
  };
}

export async function requestQuoteOrderRequestHash(
  supabase: SupabaseClient<Database>,
  data: ParsedFormData,
): Promise<string | null> {
  const { count, totalBytes } = photoMeta(data.photoFiles);
  const { data: hash, error } = await supabase.rpc("request_quote_order_request_hash", {
    p_user_id: data.userId,
    p_service_id: data.serviceId,
    p_address: data.address as Json,
    p_request_title: data.serviceRequestTitle,
    p_description: data.description,
    p_form_data: data.formData as Json,
    p_form_version: data.formVersion,
    p_structured_data: (data.structuredData ?? null) as Json,
    p_photo_count: count,
    p_photo_total_bytes: totalBytes,
  });

  if (error || typeof hash !== "string") {
    console.error("[requestQuoteOrderRequestHash]", error?.message ?? "invalid hash");
    return null;
  }

  return hash;
}

type IdempotencyHit = {
  hit?: boolean;
  response_body?: CreateOrderSuccess;
};

export async function lookupRequestQuoteOrderCache(
  supabase: SupabaseClient<Database>,
  data: ParsedFormData,
  idempotencyKey: string,
  requestHash: string,
): Promise<CreateOrderSuccess | null> {
  const { data: cached, error } = await supabase.rpc("idempotency_begin_for_actor", {
    p_actor_user_id: data.userId,
    p_operation: REQUEST_QUOTE_CREATE_ORDER_OPERATION,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
  });

  if (error) {
    console.error("[lookupRequestQuoteOrderCache]", error.message);
    return null;
  }

  const payload = cached as IdempotencyHit | null;
  if (!payload?.hit || !payload.response_body) {
    return null;
  }

  const body = payload.response_body;
  if (typeof body.requestId !== "string") {
    return null;
  }

  return {
    requestId: body.requestId,
    addressId: body.addressId ?? null,
  };
}

export async function createRequestQuoteServiceRequest(
  supabase: SupabaseClient<Database>,
  data: ParsedFormData,
  params: {
    idempotencyKey: string;
    requestHash: string;
    addressId: string | null;
    photoUrls: string[];
  },
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const structured = data.structuredData;
  const { data: result, error } = await supabase.rpc("create_request_quote_service_request", {
    p_actor_user_id: data.userId,
    p_idempotency_key: params.idempotencyKey,
    p_request_hash: params.requestHash,
    p_address_id: params.addressId,
    p_service_id: data.serviceId,
    p_request_title: data.serviceRequestTitle,
    p_description: data.description,
    p_photo_urls: params.photoUrls,
    p_form_data: data.formData as Json,
    p_form_schema: data.formSchema as Json | null,
    p_form_version: data.formVersion,
    p_urgency: structured?.urgency ?? null,
    p_scope_complexity: structured?.scope_complexity ?? null,
    p_tags: structured?.tags ?? null,
    p_missing_info_warnings: structured?.missing_info_warnings ?? null,
    p_suggested_equipment: structured?.suggested_equipment ?? null,
    p_suggested_materials: structured?.suggested_materials ?? null,
    p_estimated_duration_hint: structured?.estimated_duration_hint ?? null,
  });

  if (error) {
    console.error("[createRequestQuoteServiceRequest]", error.message);
    return { ok: false, error: error.message };
  }

  if (!result || typeof result !== "object") {
    return { ok: false, error: "Resposta inválida ao criar pedido." };
  }

  const requestId = (result as { requestId?: string }).requestId;
  if (typeof requestId !== "string") {
    return { ok: false, error: "Resposta inválida ao criar pedido." };
  }

  return { ok: true, requestId };
}
