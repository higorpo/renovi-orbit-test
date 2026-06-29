import type { ResolvedProviderAccount } from "./types.ts";

export type ProviderAccountRow = {
  provider_id: string;
  netcred_company_id: string | null;
};

export function mapProviderAccountRow(
  row: ProviderAccountRow | null,
): ResolvedProviderAccount | null {
  if (!row?.netcred_company_id?.trim()) {
    return null;
  }

  return {
    providerUserId: row.provider_id,
    netcredCompanyId: row.netcred_company_id.trim(),
  };
}
