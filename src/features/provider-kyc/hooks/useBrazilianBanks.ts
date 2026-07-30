import { useQuery } from "@tanstack/react-query";
import { fetchBrazilianBanks } from "../api/brazilianBanks.api";

export const BRAZILIAN_BANKS_QUERY_KEY = ["brazilian-banks"] as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** BrasilAPI bank list with lazy local JSON fallback and friendly name overrides. */
export function useBrazilianBanks() {
  return useQuery({
    queryKey: BRAZILIAN_BANKS_QUERY_KEY,
    queryFn: fetchBrazilianBanks,
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
  });
}
