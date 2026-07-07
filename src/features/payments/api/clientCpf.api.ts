import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export type FetchClientCpfResult = {
  cpf: string | null;
  error: string | null;
};

export async function fetchClientCpf(clientId: string): Promise<FetchClientCpfResult> {
  const { data, error } = await supabase
    .from("client_profiles_private")
    .select("cpf")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    logger.error("payment_client_cpf_fetch_error", {
      clientId,
      error: error.message,
    });
    return { cpf: null, error: error.message };
  }

  const cpf = data?.cpf?.trim() ?? null;
  return { cpf: cpf || null, error: null };
}
