import type { SettlementSyncSchedule } from "./types.ts";

/** Normalizes RPC claim rows into settlement sync schedules; drops rows without a transaction id. */
export function parseClaimedSchedules(data: unknown): SettlementSyncSchedule[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((row) => {
    const schedule = row as Record<string, unknown>;
    const gatewayTransactionId = schedule.gateway_transaction_id != null
      ? String(schedule.gateway_transaction_id).trim()
      : "";
    if (!gatewayTransactionId) {
      return [];
    }

    return [{
      id: String(schedule.schedule_id ?? schedule.id),
      provider_id: String(schedule.provider_id),
      state: String(schedule.state),
      gateway_transaction_id: gatewayTransactionId,
      gateway_slug: String(schedule.gateway_slug ?? "netcred"),
      netcred_company_id: schedule.netcred_company_id != null
        ? String(schedule.netcred_company_id)
        : null,
      paid_at: schedule.paid_at != null ? String(schedule.paid_at) : null,
    }];
  });
}
