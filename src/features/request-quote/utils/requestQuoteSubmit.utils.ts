import { logger } from "@/lib/logger";
import { uploadPhotosForRequest } from "../api/serviceRequests.api";

export async function uploadPhotosForSubmit(
  clientId: string,
  photos: File[],
  onPartialError?: () => void
): Promise<string[]> {
  if (photos.length === 0) return [];
  const up = await uploadPhotosForRequest(clientId, photos);
  if (up.error) {
    logger.warn("request_quote_upload_photos_submit_error", {
      clientId,
      photoCount: photos.length,
      error: up.error,
    });
    onPartialError?.();
  }
  return up.urls ?? [];
}

export function buildServiceRequestParams(params: {
  client_id: string;
  service_id: string;
  service_title: string;
  service_request_title?: string | null;
  address_id: string | null;
  description: string;
  photoUrls: string[];
  form_data: Record<string, unknown>;
  form_schema: Record<string, unknown> | null;
  form_version: string | null;
}) {
  return {
    client_id: params.client_id,
    service_id: params.service_id,
    address_id: params.address_id,
    title: params.service_request_title?.trim() || `Pedido de ${params.service_title}`,
    description: params.description,
    photos: params.photoUrls.length > 0 ? params.photoUrls : null,
    form_data: Object.keys(params.form_data).length > 0 ? params.form_data : null,
    form_schema: params.form_schema ?? null,
    form_version: params.form_version ?? null,
    status: "OPEN" as const,
  };
}
