import type {
  CompanyNode,
  CompanyQueryResult,
  OnboardingProcessAction,
  PendingProviderAccount,
} from "./types.ts";
import { providerAliasKey } from "./types.ts";

export type ResolvedCompanyOutcome = {
  action: OnboardingProcessAction;
  netcredCompanyId?: string;
  netcredBankAccountId?: string;
  warningReason?: string;
};

function resolveActiveBankAccount(node: CompanyNode): string | null {
  const edges = node.bankAccounts?.edges ?? [];
  for (const edge of edges) {
    const bankAccount = edge?.node;
    if (bankAccount?.id && bankAccount.isActive !== false) {
      return String(bankAccount.id);
    }
  }
  return null;
}

export function resolveCompanyOutcome(
  account: PendingProviderAccount,
  result: CompanyQueryResult | null | undefined,
): ResolvedCompanyOutcome {
  const edges = result?.edges ?? [];

  if (edges.length === 0) {
    return { action: "noop" };
  }

  if (edges.length > 1) {
    return {
      action: "warning_multiple_edges",
      warningReason: "multiple_company_edges",
    };
  }

  const node = edges[0]?.node;
  if (!node?.id) {
    return { action: "noop" };
  }

  const normalizedNodeDocument = (node.document ?? "").replace(/\D/g, "");
  const normalizedAccountDocument = account.document.replace(/\D/g, "");
  if (
    normalizedNodeDocument &&
    normalizedAccountDocument &&
    normalizedNodeDocument !== normalizedAccountDocument
  ) {
    return { action: "noop" };
  }

  const companyState = node.companyState ?? "";
  const bankAccountId = resolveActiveBankAccount(node);

  if (companyState === "ACTIVE") {
    if (!bankAccountId) {
      return {
        action: "warning_active_without_bank",
        warningReason: "active_without_bank_account",
      };
    }

    return {
      action: "activated",
      netcredCompanyId: String(node.id),
      netcredBankAccountId: bankAccountId,
    };
  }

  return { action: "under_review" };
}

export function pickAliasResult(
  data: Record<string, CompanyQueryResult | null | undefined>,
  account: PendingProviderAccount,
): CompanyQueryResult | null | undefined {
  return data[providerAliasKey(account.document)];
}
