import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import { buildBatchCompaniesQuery } from "./buildBatchQuery.ts";
import {
  pickAliasResult,
  resolveCompanyOutcome,
} from "./processCompanyResult.ts";
import type {
  CompanyQueryResult,
  OnboardingRunSummary,
  PendingProviderAccount,
} from "./types.ts";

const logger = createPaymentLogger("detect-netcred-onboarding");
const BATCH_SIZE = 50;
const INTER_BATCH_DELAY_MS = 2000;

function documentLogSuffix(document: string): string {
  const digits = document.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "****";
}

export type DetectNetcredOnboardingDeps = {
  loadPendingProviders: (limit: number) => Promise<PendingProviderAccount[]>;
  fetchCompaniesBatch: (
    query: string,
  ) => Promise<Record<string, CompanyQueryResult | null | undefined>>;
  activateProvider: (input: {
    providerAccountId: string;
    netcredCompanyId: string;
    netcredBankAccountId: string;
  }) => Promise<void>;
  markUnderReview: (providerAccountId: string) => Promise<void>;
  emitWarning: (message: string, extra: Record<string, unknown>) => void;
  sleep: (ms: number) => Promise<void>;
};

function emptySummary(): OnboardingRunSummary {
  return {
    batches: 0,
    processed: 0,
    activated: 0,
    under_review: 0,
    warnings: 0,
    skipped: 0,
  };
}

async function processBatch(
  deps: DetectNetcredOnboardingDeps,
  accounts: PendingProviderAccount[],
  summary: OnboardingRunSummary,
): Promise<void> {
  summary.batches += 1;

  const query = buildBatchCompaniesQuery(accounts);
  const data = await deps.fetchCompaniesBatch(query);

  for (const account of accounts) {
    summary.processed += 1;
    const aliasResult = pickAliasResult(data, account);
    const outcome = resolveCompanyOutcome(account, aliasResult);

    switch (outcome.action) {
      case "activated":
        if (outcome.netcredCompanyId && outcome.netcredBankAccountId) {
          await deps.activateProvider({
            providerAccountId: account.id,
            netcredCompanyId: outcome.netcredCompanyId,
            netcredBankAccountId: outcome.netcredBankAccountId,
          });
          summary.activated += 1;
        }
        break;
      case "under_review":
      case "warning_active_without_bank":
        await deps.markUnderReview(account.id);
        summary.under_review += 1;
        if (outcome.warningReason) {
          summary.warnings += 1;
          deps.emitWarning(outcome.warningReason, {
            provider_account_id: account.id,
            document_suffix: documentLogSuffix(account.document),
          });
        }
        break;
      case "warning_multiple_edges":
        summary.warnings += 1;
        summary.skipped += 1;
        deps.emitWarning(outcome.warningReason ?? "multiple_company_edges", {
          provider_account_id: account.id,
          document_suffix: documentLogSuffix(account.document),
        });
        break;
      default:
        summary.skipped += 1;
        break;
    }
  }
}

export async function handleDetectNetcredOnboardingRequest(
  req: Request,
  deps: DetectNetcredOnboardingDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const auth = validateOrbitCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.code }, auth.status, cors);
  }

  const summary = emptySummary();

  while (true) {
    const batch = await deps.loadPendingProviders(BATCH_SIZE);
    if (batch.length === 0) {
      break;
    }

    await processBatch(deps, batch, summary);

    if (batch.length < BATCH_SIZE) {
      break;
    }

    await deps.sleep(INTER_BATCH_DELAY_MS);
  }

  logger.info("onboarding_detection_completed", summary);

  return jsonResponse(summary, 200, cors);
}
