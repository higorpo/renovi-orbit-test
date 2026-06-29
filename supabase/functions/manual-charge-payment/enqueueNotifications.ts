import { resolveServiceDeepLinkPath } from "../_shared/payment/serviceDeepLink.ts";
import type { ManualChargeOutcome, ManualChargeSchedule } from "./types.ts";

export type NotificationIngestInput = {
  profileId: string;
  channel: "PUSH" | "EMAIL";
  templateKey: string;
  idempotencyKey: string;
  templateVariables: Record<string, unknown>;
  bypassLimits: boolean;
};

export async function enqueueManualChargeNotifications(
  ingest: (input: NotificationIngestInput) => Promise<void>,
  schedule: ManualChargeSchedule,
  outcome: ManualChargeOutcome,
  chargeAmount: string,
): Promise<void> {
  const baseKey = `manual-charge:${schedule.id}:${schedule.manual_attempt_count}`;
  const serviceId = schedule.contracted_service_id;
  const deepLinkPath = resolveServiceDeepLinkPath(schedule.service_request_id);

  if (outcome === "PAID") {
    await ingest({
      profileId: schedule.client_id,
      channel: "PUSH",
      templateKey: "payment_success",
      idempotencyKey: `${baseKey}:client-push`,
      templateVariables: {
        serviceId,
        chargedAmount: chargeAmount,
        installmentNumber: schedule.installment_number,
        deep_link_path: deepLinkPath,
      },
      bypassLimits: true,
    });
    await ingest({
      profileId: schedule.client_id,
      channel: "EMAIL",
      templateKey: "payment_success_email",
      idempotencyKey: `${baseKey}:client-email`,
      templateVariables: { serviceId, chargedAmount: chargeAmount, deep_link_path: deepLinkPath },
      bypassLimits: true,
    });
    await ingest({
      profileId: schedule.provider_id,
      channel: "PUSH",
      templateKey: "provider_payment_confirmed",
      idempotencyKey: `${baseKey}:provider-push`,
      templateVariables: { serviceId, deep_link_path: deepLinkPath },
      bypassLimits: true,
    });
    return;
  }

  if (outcome === "FAILED") {
    await ingest({
      profileId: schedule.client_id,
      channel: "PUSH",
      templateKey: "payment_failed_retryable",
      idempotencyKey: `${baseKey}:client-push`,
      templateVariables: {
        serviceId,
        remainingRetries: Math.max(
          0,
          schedule.max_attempts - schedule.automatic_attempt_count,
        ),
        deep_link_path: deepLinkPath,
      },
      bypassLimits: true,
    });
    return;
  }

  if (outcome === "FAILED_PERMANENT") {
    await ingest({
      profileId: schedule.client_id,
      channel: "PUSH",
      templateKey: "payment_failed_permanent",
      idempotencyKey: `${baseKey}:client-push`,
      templateVariables: {
        serviceId,
        deep_link_path: deepLinkPath,
      },
      bypassLimits: true,
    });
    return;
  }

  if (outcome === "IN_ANALYSIS") {
    await ingest({
      profileId: schedule.client_id,
      channel: "PUSH",
      templateKey: "payment_in_analysis",
      idempotencyKey: `${baseKey}:client-push`,
      templateVariables: { serviceId, deep_link_path: deepLinkPath },
      bypassLimits: false,
    });
  }
}
