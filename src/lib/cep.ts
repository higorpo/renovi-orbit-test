/**
 * CEP (Brazilian postal code) lookup via ViaCEP. Used for address autocomplete.
 */

import { logger } from "@/lib/logger";
import { addBreadcrumb } from "@/lib/sentry";

export interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  estado?: string;
  ibge?: string;
  erro?: boolean;
}

/** ViaCEP returns this when the CEP does not exist. */
export interface ViaCepNotFound {
  erro: true;
}

export async function fetchAddressByCEP(
  cep: string
): Promise<ViaCepResult | ViaCepNotFound | null> {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      addBreadcrumb({
        category: "cep",
        message: "cep.lookup_failed",
        data: { cepPrefix: cleanCEP.slice(0, 5), status: response.status },
      });
      return null;
    }
    const data = await response.json();
    if (data.erro) {
      addBreadcrumb({
        category: "cep",
        message: "cep.not_found",
        data: { cepPrefix: cleanCEP.slice(0, 5) },
      });
      return { erro: true };
    }
    addBreadcrumb({
      category: "cep",
      message: "cep.lookup_ok",
      data: { cepPrefix: cleanCEP.slice(0, 5) },
    });
    return data as ViaCepResult;
  } catch (error) {
    logger.warn("viacep_fetch_error", { cep: cleanCEP, error: String(error) });
    return null;
  }
}
