import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Database, Json } from "../_shared/database.types.ts";

export type CreateServiceRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

interface Params {
  client_id: string;
  service_id: string;
  address_id: string | null;
  service_title: string;
  description: string;
  photoUrls: string[];
  form_data: Record<string, unknown>;
  form_schema: Record<string, unknown> | null;
  form_version: string | null;
  urgency?: "low" | "medium" | "high" | null;
  scope_complexity?: "simple" | "medium" | "complex" | null;
  suggested_questions?: string[] | null;
  tags?: string[] | null;
  missing_info_warnings?: string[] | null;
}

export async function createServiceRequest(
  supabaseUrl: string,
  supabaseKey: string,
  params: Params
): Promise<CreateServiceRequestResult> {
  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const row = {
    client_id: params.client_id,
    service_id: params.service_id,
    address_id: params.address_id,
    title: `Pedido de ${params.service_title}`,
    description: params.description || null,
    photos: params.photoUrls.length > 0 ? params.photoUrls : null,
    form_data: Object.keys(params.form_data).length > 0 ? (params.form_data as Json) : null,
    form_schema: params.form_schema as Json | null,
    form_version: params.form_version ?? null,
    status: "open",
    urgency: params.urgency ?? null,
    scope_complexity: params.scope_complexity ?? null,
    suggested_questions: params.suggested_questions?.length ? params.suggested_questions : null,
    tags: params.tags?.length ? params.tags : null,
    missing_info_warnings: params.missing_info_warnings?.length ? params.missing_info_warnings : null,
  };

  const { data, error } = await supabase
    .from("service_requests")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[createServiceRequest]", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, requestId: data.id };
}
