import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Tables } from "@/lib/supabase/database.types";

export type ProviderPrivateProfile = Tables<"provider_profiles_private">;

export interface GetProviderPrivateResult {
  data: ProviderPrivateProfile | null;
  error: string | null;
}

export interface UpdateProviderPrivateParams {
  entity_type?: "pf" | "pj";
  cpf?: string | null;
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  legal_representative_name?: string | null;
  legal_representative_cpf?: string | null;
  commercial_contact?: string | null;
}

export async function getProviderPrivateProfile(
  providerId: string
): Promise<GetProviderPrivateResult> {
  const { data, error } = await supabase
    .from("provider_profiles_private")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    logger.error("provider_private_profile_fetch_error", {
      error: error.message,
      providerId,
    });
    return { data: null, error: error.message };
  }
  return { data: data as ProviderPrivateProfile | null, error: null };
}

export async function updateProviderPrivateProfile(
  providerId: string,
  params: UpdateProviderPrivateParams
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = { ...params };
  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase
    .from("provider_profiles_private")
    .upsert({ provider_id: providerId, ...payload }, { onConflict: "provider_id" });

  if (error) {
    logger.error("provider_private_profile_update_error", {
      error: error.message,
      providerId,
    });
    return { error: error.message };
  }
  return { error: null };
}
