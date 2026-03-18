import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export interface ClientPrivateProfile {
  client_id: string;
  cpf: string | null;
  updated_at: string;
}

export interface GetClientPrivateResult {
  data: ClientPrivateProfile | null;
  error: string | null;
}

export interface UpdateClientPrivateParams {
  cpf?: string | null;
}

export interface UpdateClientPrivateResult {
  error: string | null;
}

/**
 * Fetches the client's private profile (e.g. CPF) from client_profiles_private.
 * Only the client or admin can read; RLS enforced.
 */
export async function getClientPrivateProfile(
  clientId: string
): Promise<GetClientPrivateResult> {
  const { data, error } = await supabase
    .from("client_profiles_private")
    .select("client_id, cpf, updated_at")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    logger.error("client_private_profile_fetch_error", {
      error: error.message,
      clientId,
    });
    return { data: null, error: error.message };
  }

  return { data: data as ClientPrivateProfile | null, error: null };
}

/**
 * Updates the client's private profile (e.g. CPF).
 * Only the client can update; RLS enforced.
 */
export async function updateClientPrivateProfile(
  clientId: string,
  params: UpdateClientPrivateParams
): Promise<UpdateClientPrivateResult> {
  const payload: Record<string, unknown> = {};
  if ("cpf" in params) {
    payload.cpf = params.cpf?.trim() || null;
  }
  if (Object.keys(payload).length === 0) {
    return { error: null };
  }

  const { error } = await supabase
    .from("client_profiles_private")
    .upsert(
      { client_id: clientId, ...payload },
      { onConflict: "client_id" }
    );

  if (error) {
    logger.error("client_private_profile_update_error", {
      error: error.message,
      clientId,
    });
    return { error: error.message };
  }
  return { error: null };
}
