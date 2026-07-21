import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  AdapterRegistry,
  configureAdapterRegistry,
} from "../_shared/payment/registry.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import {
  handleTokenizePaymentCardRequest,
  type TokenizePaymentCardDeps,
} from "./handleRequest.ts";
import { mapProviderAccountRow } from "./resolveProviderAccount.ts";

function resolvePlatformBankAccountId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_BANK_ACCOUNT_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_BANK_ACCOUNT_ID is not configured");
  }
  return value;
}

function resolvePlatformCompanyId(): string | null {
  return Deno.env.get("NETCRED_PLATFORM_COMPANY_ID")?.trim() ?? null;
}

function createDeps(): TokenizePaymentCardDeps {
  const supabase = createServiceRoleClient();
  const platformCompanyId = resolvePlatformCompanyId();
  if (!platformCompanyId) {
    throw new Error("NETCRED_PLATFORM_COMPANY_ID is not configured");
  }

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: resolvePlatformBankAccountId(),
    platformCompanyId,
    isProduction: resolveIsProduction(),
  });

  return {
    getUser: async (token) => {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      return { user, error: error ?? null };
    },
    validateCheckoutAccess: async (clientId, proposalId) => {
      const { error } = await supabase.rpc(
        "payment_validate_tokenize_checkout_access",
        {
          p_client_id: clientId,
          p_proposal_id: proposalId,
        },
      );

      if (error) {
        throw new Error(error.message);
      }
    },
    resolvePlatformCompany: async () => {
      return mapProviderAccountRow({
        provider_id: "platform",
        netcred_company_id: platformCompanyId,
      });
    },
    tokenizeCard: (input) => AdapterRegistry.get("netcred").tokenizeCard(input),
    insertPaymentToken: async ({ clientId, parsed, tokenizeResult, netcredCompanyId }) => {
      const { data, error } = await supabase.rpc("payment_persist_client_card_token", {
        p_client_id: clientId,
        p_gateway_payment_profile_id: tokenizeResult.paymentProfileId ?? "",
        p_card_number_masked: tokenizeResult.cardNumberMasked ?? "",
        p_card_brand: tokenizeResult.cardBrand ?? "",
        p_gateway_card_token: tokenizeResult.token ?? "",
        p_expiry_month: parsed.cardData.expiryMonth,
        p_expiry_year: parsed.cardData.expiryYear,
        p_cardholder_name: parsed.cardData.cardholderName,
        p_billing_address: parsed.billingAddress,
        p_netcred_company_id: netcredCompanyId,
        p_gateway_slug: "netcred",
      });

      if (error || !data || typeof data !== "object" || data === null) {
        return null;
      }

      const row = data as Record<string, unknown>;
      const tokenId = row.client_card_token_id;
      if (typeof tokenId !== "string") {
        return null;
      }

      return {
        id: tokenId,
        card_number_masked: String(row.card_number_masked ?? ""),
        card_brand: String(row.card_brand ?? ""),
      };
    },
    recordCardTokenizedEvent: async ({ paymentTokenId, clientId }) => {
      const { error } = await supabase.rpc("payment_write_event", {
        p_event_type: "CardTokenized",
        p_aggregate_type: "client_card_token",
        p_aggregate_id: paymentTokenId,
        p_payload: {
          gateway_slug: "netcred",
          client_id: clientId,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    checkRateLimit,
  };
}

servePaymentFunction("tokenize-payment-card", (req) =>
  handleTokenizePaymentCardRequest(req, createDeps()));
