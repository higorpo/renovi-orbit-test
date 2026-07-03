import { supabase } from "@/lib/supabase/client";
import { profileApi } from "@/features/auth";
import type {
  AcceptProposalResult,
  AcceptProposalWithPaymentParams,
} from "@/features/negotiation-proposals";
import { logger } from "@/lib/logger";
import { maskCPF, maskPhone, unmask } from "@/lib/masks";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { validateBrazilPhone, validateCPF } from "@/lib/validators";
import type { CheckoutStepRequirements, ProposalCheckoutContext } from "../types/checkoutStepper.types";
import type { InstallmentOption, InstallmentOptionsResponse } from "../types/paymentToken.types";
import { invokePaymentRpc, paymentsApiErrorToMessage } from "./paymentApiClient";
import { PAYMENT_RPC } from "./payments.rpc";

export type GetCheckoutStepRequirementsResult = {
  data: CheckoutStepRequirements | null;
  error: string | null;
};

export type SaveCheckoutCpfResult = {
  cpf: string | null;
  error: string | null;
};

export type SaveCheckoutPhoneResult = {
  phone: string | null;
  error: string | null;
};

export type GetProposalCheckoutContextResult = {
  data: ProposalCheckoutContext | null;
  error: string | null;
};

export type FetchInstallmentOptionsParams = {
  proposalId: string;
  serviceId: string;
  cardBrand: string;
};

export type FetchInstallmentOptionsResult = {
  data: InstallmentOptionsResponse | null;
  error: string | null;
};

export type AcceptProposalWithPaymentResult = {
  data: AcceptProposalResult | null;
  error: string | null;
};

export type AcceptProposalCheckoutParams = AcceptProposalWithPaymentParams;

function parseCheckoutStepRequirements(
  data: unknown,
): CheckoutStepRequirements | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as Record<string, unknown>;

  return {
    needs_cpf: Boolean(payload.needs_cpf),
    needs_phone: Boolean(payload.needs_phone),
    needs_card: Boolean(payload.needs_card),
  };
}

function isCheckoutStepRequirementsPayload(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export async function getCheckoutStepRequirements(): Promise<GetCheckoutStepRequirementsResult> {
  const result = await invokePaymentRpc(
    PAYMENT_RPC.getCheckoutStepRequirements,
    {},
    isCheckoutStepRequirementsPayload,
    "payment_checkout_step_requirements_invalid_response",
  );

  if (result.error) {
    return { data: null, error: paymentsApiErrorToMessage(result.error) };
  }

  const requirements = parseCheckoutStepRequirements(result.data);
  if (!requirements) {
    return { data: null, error: "invalid_checkout_step_requirements_response" };
  }

  return { data: requirements, error: null };
}

function isProposalCheckoutContextPayload(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseProposalCheckoutContext(data: unknown): ProposalCheckoutContext | null {
  if (!isProposalCheckoutContextPayload(data)) {
    return null;
  }

  const proposalId = data.proposal_id;
  const serviceRequestId = data.service_request_id;
  const providerId = data.provider_id;
  const proposedAmount = data.proposed_amount;
  const pricingSignature = data.pricing_signature;

  if (
    typeof proposalId !== "string"
    || typeof serviceRequestId !== "string"
    || typeof providerId !== "string"
    || typeof proposedAmount !== "number"
    || typeof pricingSignature !== "string"
  ) {
    return null;
  }

  return {
    proposalId,
    serviceRequestId,
    providerId,
    proposedAmount,
    pricingSignature,
  };
}

export async function getProposalCheckoutContext(
  proposalId: string,
): Promise<GetProposalCheckoutContextResult> {
  const result = await invokePaymentRpc(
    PAYMENT_RPC.getProposalCheckoutContext,
    { p_proposal_id: proposalId },
    isProposalCheckoutContextPayload,
    "payment_proposal_checkout_context_invalid_response",
  );

  if (result.error) {
    return { data: null, error: paymentsApiErrorToMessage(result.error) };
  }

  const context = parseProposalCheckoutContext(result.data);
  if (!context) {
    return { data: null, error: "invalid_proposal_checkout_context_response" };
  }

  return { data: context, error: null };
}

function isInstallmentOptionsRpcPayload(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseInstallmentOptionsResponse(data: unknown): InstallmentOptionsResponse | null {
  if (!isInstallmentOptionsRpcPayload(data)) {
    return null;
  }

  if (!Array.isArray(data.installment_options)) {
    return null;
  }

  if (typeof data.installment_selection_hmac !== "string") {
    return null;
  }

  if (!data.installment_hmac_payload || typeof data.installment_hmac_payload !== "object") {
    return null;
  }

  const expiresAt = data.expires_at;
  const computedAt = data.computed_at;

  return {
    installment_options: data.installment_options as InstallmentOption[],
    installment_selection_hmac: data.installment_selection_hmac,
    installment_hmac_payload: data.installment_hmac_payload as InstallmentOptionsResponse["installment_hmac_payload"],
    expires_at: typeof expiresAt === "string" ? expiresAt : String(expiresAt),
    ...(computedAt !== undefined
      ? { computed_at: typeof computedAt === "string" ? computedAt : String(computedAt) }
      : {}),
  };
}

export async function fetchInstallmentOptions(
  params: FetchInstallmentOptionsParams,
): Promise<FetchInstallmentOptionsResult> {
  const result = await invokePaymentRpc(
    PAYMENT_RPC.calculateInstallmentOptions,
    {
      p_proposal_id: params.proposalId,
      p_service_id: params.serviceId,
      p_card_brand: params.cardBrand,
    },
    isInstallmentOptionsRpcPayload,
    "payment_calculate_installment_options_invalid_response",
  );

  if (result.error) {
    logger.warn("installment_options_fetch_failed", {
      error: result.error.message,
      code: result.error.code,
    });
    return { data: null, error: paymentsApiErrorToMessage(result.error) };
  }

  const parsed = parseInstallmentOptionsResponse(result.data);
  if (!parsed) {
    return { data: null, error: "invalid_installment_options_response" };
  }

  return { data: parsed, error: null };
}

function isAcceptProposalResult(value: unknown): value is AcceptProposalResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return payload.service != null && payload.proposal != null;
}

export async function acceptProposalWithPayment(
  params: AcceptProposalCheckoutParams,
): Promise<AcceptProposalWithPaymentResult> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  const result = await invokePaymentRpc(
    PAYMENT_RPC.acceptProposal,
    {
      p_proposal_id: params.proposalId,
      p_selected_slot: params.selectedSlot,
      p_idempotency_key: idempotencyKey,
      p_client_card_token_id: params.clientCardTokenId,
      p_installment_number: params.installmentNumber,
      p_installment_selection_hmac: params.installmentSelectionHmac,
      p_installment_hmac_payload: params.installmentHmacPayload,
      p_clearsale_session_id: params.clearsaleSessionId,
      p_pricing_signature: params.pricingSignature,
      p_client_ip: params.clientIp,
    },
    isAcceptProposalResult,
    "checkout_accept_proposal_invalid_response",
  );

  if (result.error) {
    return { data: null, error: paymentsApiErrorToMessage(result.error) };
  }

  return { data: result.data, error: null };
}

export async function saveCheckoutCpf(
  clientId: string,
  cpf: string,
): Promise<SaveCheckoutCpfResult> {
  const digits = unmask(cpf);

  if (!validateCPF(digits)) {
    return { cpf: null, error: "CPF inválido. Verifique os números informados." };
  }

  const formattedCpf = maskCPF(digits);

  const { error } = await supabase
    .from("client_profiles_private")
    .upsert(
      { client_id: clientId, cpf: formattedCpf },
      { onConflict: "client_id" },
    );

  if (error) {
    logger.error("checkout_cpf_save_error", {
      clientId,
      error: error.message,
    });
    return { cpf: null, error: error.message };
  }

  return { cpf: formattedCpf, error: null };
}

export async function saveCheckoutPhone(
  userId: string,
  phone: string,
): Promise<SaveCheckoutPhoneResult> {
  const trimmed = phone.trim();

  if (!trimmed || !validateBrazilPhone(trimmed)) {
    return {
      phone: null,
      error: "Telefone inválido. Verifique os números informados.",
    };
  }

  const formattedPhone = maskPhone(trimmed.replace(/\D/g, ""));

  const result = await profileApi.updateProfile(userId, { phone: formattedPhone });

  if (result.error) {
    logger.error("checkout_phone_save_error", {
      userId,
      error: result.error,
    });
    return { phone: null, error: result.error };
  }

  return { phone: formattedPhone, error: null };
}
