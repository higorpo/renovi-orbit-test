import { uploadPhotosForRequest } from "../api/serviceRequests.api";

export async function uploadPhotosForSubmit(
  clientId: string,
  photos: File[],
  onPartialError?: () => void
): Promise<string[]> {
  if (photos.length === 0) return [];
  const up = await uploadPhotosForRequest(clientId, photos);
  if (up.error && onPartialError) onPartialError();
  return up.urls ?? [];
}

export function buildServiceRequestParams(params: {
  client_id: string;
  service_id: string;
  service_title: string;
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
    title: `Pedido de ${params.service_title}`,
    description: params.description,
    photos: params.photoUrls.length > 0 ? params.photoUrls : null,
    form_data: Object.keys(params.form_data).length > 0 ? params.form_data : null,
    form_schema: params.form_schema ?? null,
    form_version: params.form_version ?? null,
    status: "open" as const,
  };
}
