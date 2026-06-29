import { resolveServiceDeepLinkPath } from "../_shared/payment/serviceDeepLink.ts";
import type { NotificationIngestInput } from "../manual-charge-payment/enqueueNotifications.ts";
import type { ReconcileApplyResult, ReconcileSchedule } from "./types.ts";

export async function enqueueReconcileNotifications(
  ingest: (input: NotificationIngestInput) => Promise<void>,
  schedule: ReconcileSchedule,
  applyResult: ReconcileApplyResult,
): Promise<void> {
  if (!applyResult.applied || !applyResult.to_state) {
    return;
  }

  const baseKey = `reconcile:${schedule.id}:${applyResult.to_state}`;
  const serviceId = schedule.contracted_service_id;
  const deepLinkPath = resolveServiceDeepLinkPath(schedule.service_request_id);
  const chargeAmount = applyResult.charge_amount
    ? Number(applyResult.charge_amount).toFixed(2)
    : "0.00";

  if (applyResult.to_state === "PAID") {
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
      templateVariables: {
        serviceId,
        chargedAmount: chargeAmount,
        deep_link_path: deepLinkPath,
      },
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

  if (applyResult.to_state === "FAILED_PERMANENT") {
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
    await ingest({
      profileId: schedule.client_id,
      channel: "EMAIL",
      templateKey: "payment_failed_permanent_email",
      idempotencyKey: `${baseKey}:client-email`,
      templateVariables: { serviceId, deep_link_path: deepLinkPath },
      bypassLimits: true,
    });
    await ingest({
      profileId: schedule.provider_id,
      channel: "PUSH",
      templateKey: "provider_client_payment_failed_permanent",
      idempotencyKey: `${baseKey}:provider-push`,
      templateVariables: { serviceId, deep_link_path: deepLinkPath },
      bypassLimits: true,
    });
  }
}
