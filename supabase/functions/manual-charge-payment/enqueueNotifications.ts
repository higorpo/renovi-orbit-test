import { resolveServiceDeepLinkPath } from "../_shared/payment/serviceDeepLink.ts";
import type { ManualChargeOutcome, ManualChargeSchedule } from "./types.ts";

const OUTCOME_TO_NOTIFICATION_EVENT: Partial<Record<ManualChargeOutcome, string>> = {
  PAID: "CHARGE_SUCCEEDED",
  FAILED: "CHARGE_FAILED",
  FAILED_PERMANENT: "CHARGE_FAILED_PERMANENT",
  IN_ANALYSIS: "CHARGE_IN_ANALYSIS",
};

export async function enqueueManualChargeNotifications(
  enqueue: (
    scheduleId: string,
    notificationEvent: string,
    metadata: Record<string, unknown>,
  ) => Promise<void>,
  schedule: ManualChargeSchedule,
  outcome: ManualChargeOutcome,
  chargeAmount: string,
): Promise<void> {
  const notificationEvent = OUTCOME_TO_NOTIFICATION_EVENT[outcome];
  if (!notificationEvent) {
    return;
  }

  await enqueue(schedule.id, notificationEvent, {
    contracted_service_id: schedule.contracted_service_id,
    chargedAmount: chargeAmount,
    installmentNumber: schedule.installment_number,
    initiator: "manual",
    deep_link_path: resolveServiceDeepLinkPath(schedule.service_request_id),
  });
}
