import type { CronChargeOutcome, CronChargeSchedule } from "./types.ts";

export type ScheduleState =
  | "SCHEDULED"
  | "PROCESSING"
  | "PAID"
  | "IN_ANALYSIS"
  | "FAILED"
  | "FAILED_PERMANENT"
  | "CANCELLED";

export type HarnessSchedule = CronChargeSchedule & {
  state: ScheduleState;
  charge_scheduled_at: Date;
  service_scheduled_at: Date | null;
  service_status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";
  locked_until: Date | null;
  next_retry_at: Date | null;
  automatic_attempt_count: number;
};

export type AuditEntry = {
  event_type: string;
  from_state: string;
  to_state: string;
  schedule_id: string;
};

export type AttemptEntry = {
  schedule_id: string;
  attempt_number: number;
  outcome: string;
};

export type PaymentEventEntry = {
  event_type: string;
  aggregate_id: string;
};

const RETRY_MINUTES = 30;
const MAX_ATTEMPTS = 3;
const AUTO_CANCEL_HOURS = 12;

export class ChargeStateHarness {
  readonly auditLog: AuditEntry[] = [];
  readonly attempts: AttemptEntry[] = [];
  readonly events: PaymentEventEntry[] = [];
  readonly notifications: string[] = [];

  private schedules = new Map<string, HarnessSchedule>();
  private idCounter = 0;

  seedSchedule(overrides: Partial<HarnessSchedule> = {}): HarnessSchedule {
    const id = overrides.id ?? `schedule-${++this.idCounter}`;
    const schedule: HarnessSchedule = {
      id,
      contracted_service_id: overrides.contracted_service_id ?? `service-${id}`,
      client_id: overrides.client_id ?? "client-1",
      provider_id: overrides.provider_id ?? "provider-1",
      gateway_slug: "netcred",
      client_card_token_id: overrides.client_card_token_id ?? "token-1",
      provider_payout: overrides.provider_payout ?? 850,
      netcred_company_id: overrides.netcred_company_id ?? "1048",
      installment_number: 1,
      base_amount: 1000,
      automatic_attempt_count: 0,
      max_attempts: MAX_ATTEMPTS,
      clearsale_session_id: "session-1",
      client_ip_address: "189.0.0.1",
      state: "SCHEDULED",
      charge_scheduled_at: new Date(Date.now() - 60_000),
      service_scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      service_status: "PENDING_PAYMENT",
      locked_until: null,
      next_retry_at: null,
      ...overrides,
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  applyEmergencyScheduling(scheduleId: string): void {
    const schedule = this.require(scheduleId);
    schedule.charge_scheduled_at = new Date();
    this.auditLog.push({
      event_type: "EMERGENCY_SCHEDULING",
      from_state: schedule.state,
      to_state: schedule.state,
      schedule_id: scheduleId,
    });
  }

  dequeue(batchSize = 10): CronChargeSchedule[] {
    const eligible = [...this.schedules.values()]
      .filter((s) =>
        (s.state === "SCHEDULED" || s.state === "FAILED")
        && s.automatic_attempt_count < s.max_attempts
        && s.charge_scheduled_at <= new Date()
        && (s.locked_until === null || s.locked_until < new Date())
        && (s.next_retry_at === null || s.next_retry_at <= new Date())
      )
      .slice(0, batchSize);

    return eligible.map((schedule) => {
      schedule.state = "PROCESSING";
      schedule.automatic_attempt_count += 1;
      schedule.locked_until = new Date(Date.now() + 10 * 60_000);
      this.auditLog.push({
        event_type: "CHARGE_ATTEMPT_STARTED",
        from_state: "SCHEDULED",
        to_state: "PROCESSING",
        schedule_id: schedule.id,
      });
      return this.toCronSchedule(schedule);
    });
  }

  commitResult(input: {
    scheduleId: string;
    outcome: CronChargeOutcome;
    chargeAmount: string;
    undoAttemptIncrement?: boolean;
    failureCode?: string;
  }): string | null {
    const schedule = this.require(input.scheduleId);
    if (schedule.state !== "PROCESSING") {
      throw new Error("INVALID_SCHEDULE_STATE");
    }

    let attemptCount = schedule.automatic_attempt_count;
    if (input.undoAttemptIncrement) {
      attemptCount = Math.max(0, attemptCount - 1);
    }

    const fromState = "PROCESSING";
    let auditEvent = "CHARGE_FAILED";
    let eventType = "ChargeFailed";

    switch (input.outcome) {
      case "PAID":
        schedule.state = "PAID";
        schedule.service_status = "CONFIRMED";
        schedule.locked_until = null;
        schedule.next_retry_at = null;
        auditEvent = "CHARGE_PAID";
        eventType = "ChargeSucceeded";
        break;
      case "IN_ANALYSIS":
        schedule.state = "IN_ANALYSIS";
        schedule.locked_until = null;
        auditEvent = "CHARGE_IN_ANALYSIS";
        eventType = "ChargeInAnalysis";
        break;
      case "FAILED_PERMANENT":
        schedule.state = "FAILED_PERMANENT";
        schedule.locked_until = null;
        schedule.next_retry_at = null;
        auditEvent = "CHARGE_FAILED_PERMANENT";
        eventType = "ChargePermanentlyFailed";
        break;
      default:
        schedule.state = "FAILED";
        schedule.locked_until = null;
        schedule.next_retry_at = new Date(Date.now() + RETRY_MINUTES * 60_000);
        break;
    }

    schedule.automatic_attempt_count = attemptCount;

    this.attempts.push({
      schedule_id: schedule.id,
      attempt_number: schedule.automatic_attempt_count,
      outcome: input.outcome === "PAID" || input.outcome === "IN_ANALYSIS"
        ? input.outcome
        : "REJECTED",
    });

    this.auditLog.push({
      event_type: auditEvent,
      from_state: fromState,
      to_state: input.outcome,
      schedule_id: schedule.id,
    });

    this.events.push({
      event_type: eventType,
      aggregate_id: schedule.id,
    });

    return schedule.id;
  }

  applyWebhookCapture(scheduleId: string, chargeAmount = "1024.29"): void {
    const schedule = this.require(scheduleId);
    if (schedule.state !== "IN_ANALYSIS") {
      throw new Error("INVALID_WEBHOOK_STATE");
    }

    schedule.state = "PAID";
    schedule.service_status = "CONFIRMED";

    this.auditLog.push({
      event_type: "WEBHOOK_CAPTURE",
      from_state: "IN_ANALYSIS",
      to_state: "PAID",
      schedule_id: scheduleId,
    });

    this.events.push({
      event_type: "ChargeSucceeded",
      aggregate_id: scheduleId,
    });

    this.notifications.push(`webhook-paid:${scheduleId}:${chargeAmount}`);
  }

  runAutoCancel(now = new Date()): string[] {
    const cancelled: string[] = [];

    for (const schedule of this.schedules.values()) {
      if (!schedule.service_scheduled_at) {
        continue;
      }

      const hoursUntilService = (schedule.service_scheduled_at.getTime() - now.getTime())
        / (60 * 60 * 1000);

      if (hoursUntilService > AUTO_CANCEL_HOURS) {
        continue;
      }

      if (["PAID", "IN_ANALYSIS", "CANCELLED", "PROCESSING"].includes(schedule.state)) {
        continue;
      }

      schedule.state = "CANCELLED";
      schedule.service_status = "CANCELLED";
      cancelled.push(schedule.contracted_service_id);

      this.auditLog.push({
        event_type: "SERVICE_AUTO_CANCELLED",
        from_state: "FAILED_PERMANENT",
        to_state: "CANCELLED",
        schedule_id: schedule.id,
      });
    }

    return cancelled;
  }

  getSchedule(id: string): HarnessSchedule {
    return this.require(id);
  }

  private require(id: string): HarnessSchedule {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`schedule_not_found:${id}`);
    }
    return schedule;
  }

  private toCronSchedule(schedule: HarnessSchedule): CronChargeSchedule {
    return {
      id: schedule.id,
      contracted_service_id: schedule.contracted_service_id,
      client_id: schedule.client_id,
      provider_id: schedule.provider_id,
      gateway_slug: schedule.gateway_slug,
      client_card_token_id: schedule.client_card_token_id,
      installment_number: schedule.installment_number,
      base_amount: schedule.base_amount,
      provider_payout: schedule.provider_payout,
      netcred_company_id: schedule.netcred_company_id ?? null,
      automatic_attempt_count: schedule.automatic_attempt_count,
      max_attempts: schedule.max_attempts,
      clearsale_session_id: schedule.clearsale_session_id,
      client_ip_address: schedule.client_ip_address,
    };
  }
}
