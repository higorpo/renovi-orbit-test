import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ServiceRequestRow } from "../types/request-quote.types";

const SERVICE_REQUESTS_BUCKET = "service-requests";

export interface CreateServiceRequestParams {
  client_id: string;
  service_id: string;
  address_id?: string | null;
  title: string;
  description: string | null;
  photos?: string[] | null;
  form_data?: Record<string, unknown> | null;
  form_schema?: Record<string, unknown> | null;
  form_version?: string | null;
  status?: string;
  city?: string | null;
  neighborhood?: string | null;
}

export interface CreateServiceRequestResult {
  request: ServiceRequestRow | null;
  error: string | null;
}

export async function createServiceRequest(
  params: CreateServiceRequestParams
): Promise<CreateServiceRequestResult> {
  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      client_id: params.client_id,
      service_id: params.service_id,
      address_id: params.address_id ?? null,
      title: params.title,
      description: params.description ?? null,
      photos: params.photos ?? null,
      form_data: (params.form_data ?? null) as import("@/lib/supabase/database.types").Json,
      form_schema: (params.form_schema ?? null) as import("@/lib/supabase/database.types").Json,
      form_version: params.form_version ?? null,
      status: params.status ?? "open",
      city: params.city ?? null,
      neighborhood: params.neighborhood ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error("request_quote_create_service_request_error", {
      clientId: params.client_id,
      error: error.message,
    });
    return { request: null, error: error.message };
  }
  return { request: data as ServiceRequestRow, error: null };
}

export interface UploadPhotosForRequestResult {
  urls: string[];
  error: string | null;
}

export async function uploadPhotosForRequest(
  clientId: string,
  files: File[]
): Promise<UploadPhotosForRequestResult> {
  if (files.length === 0) return { urls: [], error: null };
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${clientId}/${Date.now()}_${i}.${ext}`;
    const { error } = await supabase.storage
      .from(SERVICE_REQUESTS_BUCKET)
      .upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (error) {
      logger.error("request_quote_upload_photo_error", { clientId, error: error.message });
      return { urls, error: error.message };
    }
    const { data } = supabase.storage.from(SERVICE_REQUESTS_BUCKET).getPublicUrl(filePath);
    urls.push(data.publicUrl);
  }
  return { urls, error: null };
}
