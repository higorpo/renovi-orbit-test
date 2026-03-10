import type { Session } from "@supabase/supabase-js";
import { getSupabaseAnonKey } from "@/lib/supabase/client";
import type { AddressSelection } from "@/features/addresses";
import type { ServiceWithChildren } from "../types/request-quote.types";

export interface CreateRequestQuoteOrderParams {
  userId: string;
  email: string;
  step4Data: AddressSelection;
  step3Data: { description: string; photos: File[] };
  selectedService: ServiceWithChildren;
  step2Data: Record<string, unknown>;
  step2FormSchema: Record<string, unknown> | null;
  step2FormVersion: string | null;
  /** When logged in pass session; when guest pass null (anon key from Supabase client is used). */
  session: Session | null;
}

export type CreateRequestQuoteOrderResult =
  | { success: true; requestId: string; addressId: string | null }
  | { success: false; error: string; retryAfter?: number };

function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (typeof url !== "string" || !url) {
    throw new Error("VITE_SUPABASE_URL is not set");
  }
  return url.replace(/\/$/, "");
}

/** Bearer token: user session when logged in, otherwise anon key (required by Supabase Edge Functions). */
function getBearerToken(session: Session | null): string {
  return session?.access_token ?? getSupabaseAnonKey();
}

export async function createRequestQuoteOrder(
  params: CreateRequestQuoteOrderParams
): Promise<CreateRequestQuoteOrderResult> {
  const {
    userId,
    email,
    step4Data,
    step3Data,
    selectedService,
    step2Data,
    step2FormSchema,
    step2FormVersion,
    session,
  } = params;

  const accessToken = getBearerToken(session);

  if (!step4Data) {
    return { success: false, error: "Selecione um endereço." };
  }

  const addressPayload =
    step4Data.kind === "existing"
      ? {
          kind: "existing" as const,
          addressId: step4Data.addressId,
        }
      : {
          kind: "new" as const,
          formData: step4Data.formData,
          label: "Casa",
          is_default: true,
        };

  const formData = new FormData();
  formData.set("userId", userId);
  formData.set("email", email);
  formData.set("address", JSON.stringify(addressPayload));
  formData.set("serviceId", selectedService.id);
  formData.set("serviceTitle", selectedService.title ?? "Serviço");
  formData.set("description", step3Data.description);
  formData.set("formData", JSON.stringify(step2Data));
  formData.set("formSchema", step2FormSchema ? JSON.stringify(step2FormSchema) : "");
  formData.set("formVersion", step2FormVersion ?? "");

  step3Data.photos.forEach((file, i) => {
    formData.set(`photo_${i}`, file);
  });

  const url = `${getSupabaseUrl()}/functions/v1/create-request-quote-order`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const retryAfter = res.headers.get("Retry-After");
  const retryAfterNum = retryAfter ? parseInt(retryAfter, 10) : undefined;

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof (body as { message?: string }).message === "string"
        ? (body as { message: string }).message
        : "Muitas requisições. Tente novamente em alguns segundos.";
    return { success: false, error: message, retryAfter: retryAfterNum };
  }

  if (res.status === 413) {
    return { success: false, error: "Arquivos muito grandes. Reduza o tamanho das fotos." };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : "Ocorreu um erro. Tente novamente.";
    return { success: false, error: message };
  }

  const requestId = (data as { requestId?: string }).requestId;
  const addressId = (data as { addressId?: string | null }).addressId ?? null;

  if (typeof requestId !== "string") {
    return { success: false, error: "Resposta inválida do servidor." };
  }

  return { success: true, requestId, addressId };
}
