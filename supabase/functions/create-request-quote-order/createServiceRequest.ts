import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Database, Json } from "../_shared/database.types.ts";

export type CreateServiceRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

interface Params {
  client_id: string;
  service_id: string;
  address_id: string;
  service_title: string;
  description: string;
  photoUrls: string[];
  form_data: Record<string, unknown>;
  form_schema: Record<string, unknown> | null;
  form_version: string | null;
  city: string;
  neighborhood: string;
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
    city: params.city,
    neighborhood: params.neighborhood,
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
