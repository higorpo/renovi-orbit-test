import { createAddress } from "@/features/addresses";
import { unmask } from "@/lib/masks";
import { uploadPhotosForRequest } from "../api/serviceRequests.api";
import { stepAddressSchema } from "../components/RequestQuote/schemas";
import type { Step4Data } from "../components/RequestQuote/schemas";

export type ResolveAddressResult =
  | { ok: true; addressId: string | null; city: string; neighborhood: string }
  | { ok: false; error: string };

export async function resolveAddressForSubmit(
  userId: string,
  step4Data: Step4Data,
  options: { defaultLabel: string; isDefault: boolean }
): Promise<ResolveAddressResult> {
  if (!step4Data) {
    return { ok: false, error: "Selecione um endereço ou cadastre um novo." };
  }
  if (step4Data.kind === "existing") {
    return {
      ok: true,
      addressId: step4Data.addressId,
      city: step4Data.city,
      neighborhood: step4Data.neighborhood,
    };
  }
  const parsed = stepAddressSchema.safeParse(step4Data.formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const formData = parsed.data;
  const cleanCep = unmask(formData.address_zip);
  const { address: newAddr, error: addrErr } = await createAddress({
    client_id: userId,
    label: options.defaultLabel,
    street: formData.address_street,
    number: formData.address_number,
    complement: formData.address_complement || null,
    neighborhood: formData.address_neighborhood,
    city: formData.address_city,
    state: formData.address_state,
    zip_code: cleanCep,
    is_default: options.isDefault,
    is_active: true,
  });
  if (addrErr) {
    return { ok: false, error: "Erro ao salvar endereço. Tente novamente." };
  }
  return {
    ok: true,
    addressId: newAddr?.id ?? null,
    city: formData.address_city,
    neighborhood: formData.address_neighborhood,
  };
}

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
  city: string;
  neighborhood: string;
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
    city: params.city,
    neighborhood: params.neighborhood,
  };
}
