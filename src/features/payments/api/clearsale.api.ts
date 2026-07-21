import { logger } from "@/lib/logger";
import { invokePaymentRpc, paymentsApiErrorToMessage } from "./paymentApiClient";
import { PAYMENT_RPC } from "./payments.rpc";

export type ClearSaleSessionPurpose = "accept" | "manual";

export type IssueClearSaleSessionParams = {
  purpose: ClearSaleSessionPurpose;
  proposalId?: string;
  scheduleId?: string;
};

export type IssueClearSaleSessionResult = {
  sessionId: string | null;
  expiresAt: string | null;
  error: string | null;
};

type IssueClearSaleSessionPayload = {
  session_id: string;
  expires_at: string;
  purpose: string;
};

function isIssueClearSaleSessionPayload(
  value: unknown,
): value is IssueClearSaleSessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return typeof payload.session_id === "string" && payload.session_id.length > 0;
}

export async function issueClearSaleSession(
  params: IssueClearSaleSessionParams,
): Promise<IssueClearSaleSessionResult> {
  const result = await invokePaymentRpc(
    PAYMENT_RPC.issueClearSaleSession,
    {
      p_purpose: params.purpose,
      p_proposal_id: params.proposalId ?? null,
      p_schedule_id: params.scheduleId ?? null,
    },
    isIssueClearSaleSessionPayload,
    "clearsale_issue_session_invalid_response",
  );

  if (result.error || !result.data) {
    logger.warn("clearsale_issue_session_failed", {
      purpose: params.purpose,
      proposal_id: params.proposalId,
      schedule_id: params.scheduleId,
      error: result.error?.message ?? "unknown",
    });
    return {
      sessionId: null,
      expiresAt: null,
      error: paymentsApiErrorToMessage(result.error),
    };
  }

  return {
    sessionId: result.data.session_id,
    expiresAt: result.data.expires_at,
    error: null,
  };
}
