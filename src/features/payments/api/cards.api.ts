import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { CardFormData } from "../types/cardForm.validation";
import type { InstallmentHmacPayload, SavedPaymentToken } from "../types/paymentToken.types";
import {
  fetchInstallmentOptions,
  type FetchInstallmentOptionsParams,
  type FetchInstallmentOptionsResult,
} from "./checkout.api";
import {
  normalizeCardDigits,
  normalizeExpiryYear,
} from "../utils/card-validator";
import { parsePaymentRpcDetailObject } from "../utils/paymentApiErrors";
import { mapPaymentUserMessage } from "../utils/mapPaymentUserMessage";
import {
  invokePaymentEdgeFunction,
  invokePaymentRpc,
  mapEdgeErrorPayload,
  trackPaymentApiError,
} from "./paymentApiClient";
import { PAYMENT_EDGE } from "./payments.edge";
import { PAYMENT_RPC } from "./payments.rpc";

export type TokenizeCardBillingAddress = {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  additionalDetails?: string;
};

export type TokenizeCardRequest = {
  providerServiceId?: string;
  tokenizeContext?: "checkout" | "profile";
  cardData: {
    cardNumber: string;
    cvv: string;
    expiryMonth: number;
    expiryYear: number;
    cardholderName: string;
  };
  billingAddress: TokenizeCardBillingAddress;
  cpf: string;
  phone: string;
};

export type TokenizeCardSuccess = {
  paymentTokenId: string;
  cardNumberMasked: string;
  cardBrand: string;
};

export type TokenizeCardResult = {
  data: TokenizeCardSuccess | null;
  error: string | null;
  gatewayErrors?: Array<{ message: string; code?: string }>;
};

export type ListActivePaymentTokensResult = {
  data: SavedPaymentToken[];
  error: string | null;
};

export type FetchPaymentTokenResult = {
  data: SavedPaymentToken | null;
  error: string | null;
};

export type { FetchInstallmentOptionsParams, FetchInstallmentOptionsResult };
export { fetchInstallmentOptions };

export type BlockedPaymentSchedule = {
  scheduleId: string;
  contractedServiceId: string;
  state: string;
};

export type RevokePaymentTokenOutcome =
  | { outcome: "revoked"; paymentTokenId: string }
  | { outcome: "blocked"; schedules: BlockedPaymentSchedule[] }
  | { outcome: "not_found" };

export type RevokePaymentTokenResult = {
  data: RevokePaymentTokenOutcome | null;
  error: string | null;
};

const CLIENT_CARD_TOKENS_READ_MODEL = "client_card_tokens_safe_v" as const;

const TOKEN_SELECT =
  "id, card_number_masked, card_brand, expiry_month, expiry_year, state";

type RpcSuccessResponse = {
  client_card_token_id: string;
  state: string;
};

type RpcBlockedSchedule = {
  schedule_id: string;
  contracted_service_id: string;
  state: string;
};

function mapBlockedSchedules(raw: unknown): BlockedPaymentSchedule[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item): item is RpcBlockedSchedule =>
      typeof item === "object"
      && item !== null
      && "schedule_id" in item
      && "contracted_service_id" in item
      && "state" in item,
    )
    .map((schedule) => ({
      scheduleId: schedule.schedule_id,
      contractedServiceId: schedule.contracted_service_id,
      state: schedule.state,
    }));
}

export function mapCardFormToTokenizeRequest(
  form: CardFormData,
  options: {
    providerServiceId?: string;
    tokenizeContext?: "checkout" | "profile";
    phone: string;
  },
): TokenizeCardRequest {
  return {
    providerServiceId: options.providerServiceId,
    tokenizeContext:
      options.tokenizeContext ?? (options.providerServiceId ? "checkout" : "profile"),
    cardData: {
      cardNumber: normalizeCardDigits(form.cardNumber),
      cvv: normalizeCardDigits(form.cvv),
      expiryMonth: Number.parseInt(form.expiryMonth, 10),
      expiryYear: normalizeExpiryYear(form.expiryYear),
      cardholderName: form.cardholderName.trim(),
    },
    billingAddress: {
      street: form.street.trim(),
      number: form.number.trim(),
      district: form.district.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      zipCode: normalizeCardDigits(form.zipCode),
      additionalDetails: form.additionalDetails?.trim() || undefined,
    },
    cpf: form.cardholderCpf.replace(/\D/g, ""),
    phone: options.phone.replace(/\D/g, ""),
  };
}

export async function fetchPaymentTokenById(
  paymentTokenId: string,
): Promise<FetchPaymentTokenResult> {
  const { data, error } = await supabase
    .from(CLIENT_CARD_TOKENS_READ_MODEL)
    .select(TOKEN_SELECT)
    .eq("id", paymentTokenId)
    .maybeSingle();

  if (error) {
    logger.error("payment_token_fetch_error", {
      paymentTokenId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  return {
    data: (data as SavedPaymentToken | null) ?? null,
    error: null,
  };
}

export async function listActivePaymentTokens(): Promise<ListActivePaymentTokensResult> {
  // CHK-042b: never trust a caller-supplied clientId — scope from the session.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: [], error: authError?.message ?? "Unauthorized" };
  }

  const { data, error } = await supabase
    .from(CLIENT_CARD_TOKENS_READ_MODEL)
    .select(TOKEN_SELECT)
    .eq("client_id", user.id)
    .eq("state", "ACTIVE")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("payment_tokens_list_error", {
      error: error.message,
    });
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []) as SavedPaymentToken[],
    error: null,
  };
}

export async function tokenizePaymentCard(
  request: TokenizeCardRequest,
): Promise<TokenizeCardResult> {
  const { ok, status, payload } = await invokePaymentEdgeFunction(
    PAYMENT_EDGE.tokenizePaymentCard,
    {
      providerServiceId: request.providerServiceId,
      tokenizeContext: request.tokenizeContext,
      cardData: request.cardData,
      billingAddress: request.billingAddress,
      cpf: request.cpf,
      phone: request.phone,
    },
  );

  if (!ok) {
    const gatewayErrors = Array.isArray(payload.errors)
      ? (payload.errors as Array<{ message: string; code?: string }>)
      : undefined;
    const { errorCode, message: edgeMessage } = mapEdgeErrorPayload(
      payload,
      "Falha ao tokenizar cartão",
    );
    const code =
      gatewayErrors?.[0]?.code
      ?? errorCode
      ?? (typeof gatewayErrors?.[0]?.message === "string" ? gatewayErrors[0].message : null)
      ?? edgeMessage;

    logger.warn("tokenize_payment_card_failed", {
      status,
      errorCode: code,
      error: edgeMessage,
    });

    return {
      data: null,
      error: mapPaymentUserMessage(code, {
        fallback: "Não foi possível salvar o cartão. Verifique os dados e tente novamente.",
      }),
      gatewayErrors,
    };
  }

  return {
    data: {
      paymentTokenId: String(payload.payment_token_id),
      cardNumberMasked: String(payload.card_number_masked),
      cardBrand: String(payload.card_brand),
    },
    error: null,
  };
}

export async function revokePaymentToken(
  paymentTokenId: string,
): Promise<RevokePaymentTokenResult> {
  const { data, error } = await supabase.rpc(PAYMENT_RPC.revokeClientCardToken, {
    p_client_card_token_id: paymentTokenId,
  });

  if (error) {
    const detail = parsePaymentRpcDetailObject(error.details);
    const code = typeof detail?.code === "string" ? detail.code : error.message;

    if (code === "CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE") {
      return {
        data: {
          outcome: "blocked",
          schedules: mapBlockedSchedules(detail?.schedules),
        },
        error: null,
      };
    }

    if (code === "CLIENT_CARD_TOKEN_NOT_FOUND" || error.code === "P0002") {
      return { data: { outcome: "not_found" }, error: null };
    }

    trackPaymentApiError(PAYMENT_RPC.revokeClientCardToken, code);
    logger.error("payment_revoke_client_card_token_error", {
      paymentTokenId,
      error: error.message,
    });
    return {
      data: null,
      error: mapPaymentUserMessage(code, {
        fallback: "Não foi possível remover este cartão. Tente novamente.",
      }),
    };
  }

  const payload = data as RpcSuccessResponse;

  return {
    data: {
      outcome: "revoked",
      paymentTokenId: payload.client_card_token_id ?? paymentTokenId,
    },
    error: null,
  };
}

export type UpdatePaymentMethodRequest = {
  contractedServiceId: string;
  newPaymentTokenId: string;
  installmentSelectionHmac?: string;
  installmentHmacPayload?: InstallmentHmacPayload;
  installmentNumber?: number;
};

export type UpdatePaymentMethodResult = {
  data: { scheduleId: string; installmentNumber?: number } | null;
  error: string | null;
  errorCode?: string;
};

function isUpdatePaymentMethodPayload(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseUpdatePaymentMethodResponse(
  data: unknown,
): { scheduleId: string; installmentNumber?: number } | null {
  if (!isUpdatePaymentMethodPayload(data)) {
    return null;
  }

  const scheduleId = data.schedule_id;
  if (typeof scheduleId !== "string") {
    return null;
  }

  const installmentNumber = data.installment_number;
  return {
    scheduleId,
    ...(typeof installmentNumber === "number" ? { installmentNumber } : {}),
  };
}

export async function updatePaymentMethod(
  request: UpdatePaymentMethodRequest,
): Promise<UpdatePaymentMethodResult> {
  const result = await invokePaymentRpc(
    PAYMENT_RPC.updatePaymentMethod,
    {
      p_service_id: request.contractedServiceId,
      p_new_client_card_token_id: request.newPaymentTokenId,
      ...(request.installmentSelectionHmac && request.installmentHmacPayload
        ? {
            p_installment_selection_hmac: request.installmentSelectionHmac,
            p_installment_hmac_payload: request.installmentHmacPayload,
          }
        : {}),
      ...(request.installmentNumber != null
        ? { p_installment_number: request.installmentNumber }
        : {}),
    },
    isUpdatePaymentMethodPayload,
    "payment_update_method_invalid_response",
  );

  if (result.error) {
    logger.warn("update_payment_method_failed", {
      errorCode: result.error.code,
      error: result.error.message,
    });

    return {
      data: null,
      error: mapPaymentUserMessage(result.error.code, {
        fallback: "Não foi possível atualizar o cartão. Tente novamente.",
      }),
      errorCode: result.error.code,
    };
  }

  const parsed = parseUpdatePaymentMethodResponse(result.data);
  if (!parsed) {
    return {
      data: null,
      error: "Não foi possível atualizar o cartão. Tente novamente.",
    };
  }

  return { data: parsed, error: null };
}
