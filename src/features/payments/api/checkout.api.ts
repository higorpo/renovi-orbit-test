import { supabase } from "@/lib/supabase/client";
import { profileApi } from "@/features/auth";
import { logger } from "@/lib/logger";
import { maskCPF, maskPhone, unmask } from "@/lib/masks";
import { validateBrazilPhone, validateCPF } from "@/lib/validators";
import type { CheckoutStepRequirements, ProposalCheckoutContext } from "../types/checkoutStepper.types";
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
  const paymentRequired = data.payment_required;

  if (
    typeof proposalId !== "string"
    || typeof serviceRequestId !== "string"
    || typeof providerId !== "string"
    || typeof proposedAmount !== "number"
    || typeof pricingSignature !== "string"
    || typeof paymentRequired !== "boolean"
  ) {
    return null;
  }

  return {
    proposalId,
    serviceRequestId,
    providerId,
    proposedAmount,
    pricingSignature,
    paymentRequired,
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
