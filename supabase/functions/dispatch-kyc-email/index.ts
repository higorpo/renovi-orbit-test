import "xhr";
import type { Json } from "../_shared/database.types.ts";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleDispatchKycEmailRequest,
  PROVIDER_KYC_DEEP_LINK_PATH,
  type DispatchKycEmailDeps,
} from "./handleRequest.ts";
import { PROVIDER_KYC_DOCUMENTS_BUCKET } from "./kycAttachments.ts";
import {
  resolveCredenciamentoRecipientEmail,
  sendCredenciamentoEmail,
} from "./sendCredenciamentoEmail.ts";
import type { ProviderGatewayAccountRow, ProviderKycContext } from "./types.ts";

function createDeps(): DispatchKycEmailDeps {
  const supabase = createServiceRoleClient();

  return {
    getUser: async (token) => {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      return { user, error: error ?? null };
    },
    loadGatewayAccount: async (providerId) => {
      const { data, error } = await supabase
        .from("provider_gateway_accounts")
        .select("id, provider_id, document, onboarding_status, email_dispatched_at")
        .eq("provider_id", providerId)
        .eq("gateway_slug", "netcred")
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data as ProviderGatewayAccountRow;
    },
    loadProviderKycContext: async ({ providerId, gatewayAccount, authEmail }) => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, phone, role")
        .eq("id", providerId)
        .maybeSingle();

      if (profileError || !profile || profile.role !== "provider") {
        return null;
      }

      const { data: privateProfile, error: privateError } = await supabase
        .from("provider_profiles_private")
        .select(
          "entity_type, cpf, cnpj, razao_social, nome_fantasia, legal_representative_name, legal_representative_cpf, legal_representative_phone, bank_institution_code, bank_branch, bank_account, pix_key, identity_doc_storage_path, address_proof_storage_path, corporate_charter_storage_path, legal_rep_doc_storage_path",
        )
        .eq("provider_id", providerId)
        .maybeSingle();

      if (
        privateError
        || !privateProfile
        || !privateProfile.bank_institution_code
        || !privateProfile.bank_branch
        || !privateProfile.bank_account
        || !privateProfile.identity_doc_storage_path
        || !privateProfile.address_proof_storage_path
      ) {
        return null;
      }

      const entityType = privateProfile.entity_type === "pj" ? "pj" : "pf";

      const context: ProviderKycContext = {
        providerId,
        gatewayAccount,
        profile: {
          fullName: profile.full_name,
          phone: profile.phone,
          email: authEmail,
        },
        privateProfile: {
          entityType,
          cpf: privateProfile.cpf,
          cnpj: privateProfile.cnpj,
          razaoSocial: privateProfile.razao_social,
          nomeFantasia: privateProfile.nome_fantasia,
          legalRepresentativeName: privateProfile.legal_representative_name,
          legalRepresentativeCpf: privateProfile.legal_representative_cpf,
          legalRepresentativePhone: privateProfile.legal_representative_phone
            ?? profile.phone,
          bankInstitutionCode: privateProfile.bank_institution_code,
          bankBranch: privateProfile.bank_branch,
          bankAccount: privateProfile.bank_account,
          pixKey: privateProfile.pix_key,
          identityDocStoragePath: privateProfile.identity_doc_storage_path,
          addressProofStoragePath: privateProfile.address_proof_storage_path,
          corporateCharterStoragePath: privateProfile.corporate_charter_storage_path,
          legalRepDocStoragePath: privateProfile.legal_rep_doc_storage_path,
        },
      };

      return context;
    },
    downloadStorageObject: async (bucket, path) => {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      return {
        data,
        error: error?.message ?? null,
      };
    },
    sendCredenciamentoEmail,
    markEmailDispatched: async (providerGatewayAccountId) => {
      const { error } = await supabase.rpc(
        "payment_mark_kyc_credenciamento_email_dispatched",
        { p_provider_gateway_account_id: providerGatewayAccountId },
      );

      if (error) {
        throw new Error(error.message);
      }
    },
    ingestProviderKycSubmitted: async ({ providerId, providerGatewayAccountId }) => {
      const { error } = await supabase.rpc("mmd_ingest_event", {
        p_event_type: "PROVIDER_KYC_SUBMITTED",
        p_recipient_profile_id: providerId,
        p_idempotency_key: `provider-kyc-submitted:${providerGatewayAccountId}`,
        p_template_variables: {
          provider_id: providerId,
          deep_link_path: PROVIDER_KYC_DEEP_LINK_PATH,
        } satisfies Json,
        p_metadata: {
          source: "dispatch-kyc-email",
          provider_gateway_account_id: providerGatewayAccountId,
        } satisfies Json,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    resolveCredenciamentoRecipientEmail,
    checkRateLimit,
  };
}

servePaymentFunction("dispatch-kyc-email", (req) =>
  handleDispatchKycEmailRequest(req, createDeps()));

export { PROVIDER_KYC_DOCUMENTS_BUCKET };
