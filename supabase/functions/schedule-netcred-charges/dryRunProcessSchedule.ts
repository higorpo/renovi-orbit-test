import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import type { CronChargeSchedule } from "./types.ts";

const logger = createPaymentLogger("schedule-netcred-charges");

export async function releaseDryRunLease(
  revertLease: (scheduleId: string, attemptCount: number) => Promise<void>,
  schedule: CronChargeSchedule,
): Promise<void> {
  await revertLease(schedule.id, schedule.automatic_attempt_count);
}

export async function logAndReleaseDryRunSchedule(
  schedule: CronChargeSchedule,
  revertLease: (scheduleId: string, attemptCount: number) => Promise<void>,
): Promise<void> {
  logger.info("charge_cron_dry_run", {
    service_id: schedule.contracted_service_id,
    schedule_id: schedule.id,
    gateway_slug: schedule.gateway_slug,
    installment_number: schedule.installment_number,
    base_amount: schedule.base_amount,
    automatic_attempt_count: schedule.automatic_attempt_count,
    client_card_token_id: schedule.client_card_token_id,
    event: PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_STARTED,
    dry_run: true,
  });

  await releaseDryRunLease(revertLease, schedule);
}
