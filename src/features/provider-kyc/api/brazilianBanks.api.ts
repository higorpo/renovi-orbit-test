import { logger } from "@/lib/logger";
import {
  loadBrazilianBanksFallback,
  mapBrasilApiBanks,
  type BrasilApiBank,
  type BrazilianBank,
} from "../constants/brazilianBanks";

export const BRASIL_API_BANKS_URL = "https://brasilapi.com.br/api/banks/v1";

function isBrasilApiBank(value: unknown): value is BrasilApiBank {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.ispb === "string"
    && typeof row.name === "string"
    && typeof row.fullName === "string"
    && (row.code === null || typeof row.code === "number")
  );
}

/** Loads banks from BrasilAPI; on any failure lazily loads the bundled JSON fallback. */
export async function fetchBrazilianBanks(): Promise<BrazilianBank[]> {
  try {
    const response = await fetch(BRASIL_API_BANKS_URL);
    if (!response.ok) {
      throw new Error(`BrasilAPI banks HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) {
      throw new Error("BrasilAPI banks returned an empty payload");
    }
    if (!payload.every(isBrasilApiBank)) {
      throw new Error("BrasilAPI banks returned an unexpected shape");
    }

    const banks = mapBrasilApiBanks(payload);
    if (banks.length === 0) {
      throw new Error("BrasilAPI banks mapped to an empty list");
    }

    return banks;
  } catch (error: unknown) {
    logger.warn("brazilian_banks_api_fallback", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [...(await loadBrazilianBanksFallback())];
  }
}
