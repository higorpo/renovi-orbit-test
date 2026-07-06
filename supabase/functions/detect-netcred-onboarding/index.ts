import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import { emitProviderMultipleEdgesWarning } from "../_shared/observability/payment-sentry-matrix.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { fetchWithTimeout } from "../_shared/providerHttp.ts";
import { getNetCredToken, resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import { resolveNetCredApiBaseUrl, buildNetCredAuthorizationHeader } from "../_shared/payment/constants.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleDetectNetcredOnboardingRequest,
  type DetectNetcredOnboardingDeps,
} from "./handleRequest.ts";
import type { CompanyQueryResult, PendingProviderAccount } from "./types.ts";

const logger = createPaymentLogger("detect-netcred-onboarding");

function parsePendingAccounts(data: unknown): PendingProviderAccount[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const account = row as Record<string, unknown>;
    return {
      id: String(account.id),
      provider_id: String(account.provider_id),
      document: String(account.document),
      onboarding_status: String(account.onboarding_status),
    };
  });
}

function createDeps(): DetectNetcredOnboardingDeps {
  const supabase = createServiceRoleClient();
  const graphqlUrl = `${resolveNetCredApiBaseUrl((key) => Deno.env.get(key))}/graphql`;

  return {
    loadPendingProviders: async (limit) => {
      const { data, error } = await supabase.rpc(
        "payment_list_gateway_accounts_for_onboarding",
        { p_batch_size: limit },
      );

      if (error) {
        logger.warn("onboarding_list_failed", { error: error.message });
        return [];
      }

      return parsePendingAccounts(data);
    },
    fetchCompaniesBatch: async (query) => {
      const token = await getNetCredToken({
        supabase,
        isProduction: resolveIsProduction(),
        graphqlUrl,
      });

      const response = await fetchWithTimeout(graphqlUrl, {
        method: "POST",
        headers: {
          Authorization: buildNetCredAuthorizationHeader(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`NETCRED_GRAPHQL_HTTP_${response.status}`);
      }

      const payload = await response.json() as {
        data?: Record<string, CompanyQueryResult | null>;
        errors?: Array<{ message?: string }>;
      };

      const authError = payload.errors?.find((entry) =>
        /not logged in|unauthorized|unauthenticated|invalid token/i.test(
          entry.message ?? "",
        )
      );
      if (authError) {
        throw new Error(`NETCRED_GRAPHQL_AUTH: ${authError.message}`);
      }

      return payload.data ?? {};
    },
    activateProvider: async (input) => {
      const { error } = await supabase.rpc("payment_activate_provider_from_netcred", {
        p_provider_gateway_account_id: input.providerAccountId,
        p_netcred_company_id: input.netcredCompanyId,
        p_netcred_bank_account_id: input.netcredBankAccountId,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    markUnderReview: async (providerAccountId) => {
      const { error } = await supabase.rpc("payment_update_provider_onboarding_status", {
        p_provider_gateway_account_id: providerAccountId,
        p_onboarding_status: "UNDER_NETCRED_REVIEW",
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    emitWarning: (message, extra) => {
      logger.warn(message, extra);
      if (
        message === "multiple_company_edges" &&
        typeof extra.document === "string" &&
        typeof extra.edges_count === "number"
      ) {
        void emitProviderMultipleEdgesWarning({
          document: extra.document,
          edges_count: extra.edges_count,
        });
      }
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

servePaymentFunction("detect-netcred-onboarding", (req) =>
  handleDetectNetcredOnboardingRequest(req, createDeps()));
