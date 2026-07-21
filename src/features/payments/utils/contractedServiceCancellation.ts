export type CancellationViewerRole = "client" | "provider";

export type ClientRefundPenaltyTier = "FULL_REFUND" | "PENALTY_10" | "PENALTY_30";

/** EXECUTED is cancellable when a PAID schedule exists (RPC allows; UI previously blocked). */
const NON_CANCELLABLE_SERVICE_STATUSES = new Set(["CANCELLED", "COMPLETED"]);

const BLOCKED_SCHEDULE_STATES = new Set([
  "IN_ANALYSIS",
  "PROCESSING",
  "REFUND_REQUESTED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELLED",
]);

const CANCELLABLE_SCHEDULE_STATES = new Set([
  "SCHEDULED",
  "FAILED",
  "FAILED_PERMANENT",
  "PAID",
]);

const SHIFT_START_HOUR: Record<string, number> = {
  morning: 8,
  afternoon: 13,
  full_day: 8,
};

const SAO_PAULO_TZ = "America/Sao_Paulo";

export function isPreChargeScheduleState(state: string): boolean {
  return state === "SCHEDULED" || state === "FAILED" || state === "FAILED_PERMANENT";
}

export function canCancelContractedService(input: {
  serviceStatus: string;
  scheduleState?: string | null;
}): boolean {
  const { serviceStatus, scheduleState } = input;

  if (NON_CANCELLABLE_SERVICE_STATUSES.has(serviceStatus)) {
    return false;
  }

  if (!scheduleState) {
    return serviceStatus === "PENDING_PAYMENT" || serviceStatus === "CONFIRMED";
  }

  if (BLOCKED_SCHEDULE_STATES.has(scheduleState)) {
    return false;
  }

  return CANCELLABLE_SCHEDULE_STATES.has(scheduleState);
}

/**
 * Approximates service execution instant in America/Sao_Paulo (CHK-038).
 * Prefer `serviceExecutionAt` from the API when available.
 */
export function approximateServiceExecutionAt(
  scheduledStartDate: string,
  scheduledShift: string,
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduledStartDate.trim());
  if (!match) {
    return null;
  }

  const hour = SHIFT_START_HOUR[scheduledShift] ?? 8;
  const isoLocal = `${match[1]}-${match[2]}-${match[3]}T${String(hour).padStart(2, "0")}:00:00`;

  // Interpret wall-clock in America/Sao_Paulo via Intl offset at that calendar day.
  const probe = new Date(`${isoLocal}Z`);
  if (Number.isNaN(probe.getTime())) {
    return null;
  }

  const offsetMinutes = getTimeZoneOffsetMinutes(SAO_PAULO_TZ, probe);
  if (offsetMinutes == null) {
    return null;
  }

  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      hour,
      0,
      0,
      0,
    ) -
      offsetMinutes * 60_000,
  );
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = dtf.formatToParts(date);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value;
    if (!tzName) {
      return null;
    }
    const match = /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(tzName);
    if (!match) {
      return tzName === "GMT" ? 0 : null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2] ?? "0");
    const sign = hours < 0 || match[1].startsWith("-") ? -1 : 1;
    return sign * (Math.abs(hours) * 60 + minutes);
  } catch {
    return null;
  }
}

export function estimateClientPenaltyTier(
  serviceExecutionAt: Date,
  now: Date = new Date(),
): ClientRefundPenaltyTier {
  const hoursUntilExecution =
    (serviceExecutionAt.getTime() - now.getTime()) / (60 * 60 * 1000);

  if (hoursUntilExecution > 48) {
    return "FULL_REFUND";
  }

  if (hoursUntilExecution >= 12) {
    return "PENALTY_10";
  }

  return "PENALTY_30";
}

export function estimateClientRefundAmount(
  baseAmount: number,
  chargeAmount: number,
  serviceExecutionAt: Date,
  now: Date = new Date(),
): { refundAmount: number; penaltyTier: ClientRefundPenaltyTier } {
  const hoursUntilExecution =
    (serviceExecutionAt.getTime() - now.getTime()) / (60 * 60 * 1000);

  // FULL_REFUND returns the full amount paid (service + card fees).
  if (hoursUntilExecution > 48) {
    return { refundAmount: roundCurrency(chargeAmount), penaltyTier: "FULL_REFUND" };
  }

  if (hoursUntilExecution >= 12) {
    return {
      refundAmount: roundCurrency(Math.min(baseAmount * 0.9, chargeAmount)),
      penaltyTier: "PENALTY_10",
    };
  }

  return {
    refundAmount: roundCurrency(Math.min(baseAmount * 0.7, chargeAmount)),
    penaltyTier: "PENALTY_30",
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export type CancellationDisclosure = {
  title: string;
  description: string;
  confirmLabel: string;
};

export function getCancellationDisclosure(input: {
  viewerRole: CancellationViewerRole;
  scheduleState: string;
  scheduledStartDate: string;
  scheduledShift: string;
  /** Prefer server `contracted_services.service_execution_at` (America/Sao_Paulo). */
  serviceExecutionAt?: string | Date | null;
  baseAmount?: number | null;
  paidAmount?: number | null;
}): CancellationDisclosure {
  if (isPreChargeScheduleState(input.scheduleState)) {
    return {
      title: "Cancelar serviço?",
      description:
        "A cobrança ainda não foi realizada. O serviço será cancelado sem custo e o prestador será notificado.",
      confirmLabel: "Cancelar serviço",
    };
  }

  if (input.viewerRole === "provider") {
    return {
      title: "Cancelar serviço?",
      description:
        "O cliente receberá estorno integral do valor pago, incluindo taxas de cartão. O processamento pode levar de 30 a 60 dias para aparecer na fatura.",
      confirmLabel: "Confirmar cancelamento",
    };
  }

  const executionAt = resolveServiceExecutionAt(input);

  if (!executionAt) {
    return {
      title: "Cancelar serviço?",
      description:
        "Se o pagamento já foi realizado, será processado um estorno conforme nossos Termos de Uso.",
      confirmLabel: "Confirmar cancelamento",
    };
  }

  const baseAmount = input.baseAmount;
  const paidAmount = input.paidAmount;
  const canEstimate =
    baseAmount != null &&
    baseAmount > 0 &&
    paidAmount != null &&
    paidAmount > 0;

  if (canEstimate) {
    const { refundAmount, penaltyTier } = estimateClientRefundAmount(
      baseAmount,
      paidAmount,
      executionAt,
    );
    const refundHint = describeClientRefundPenalty(penaltyTier, refundAmount);
    return {
      title: "Cancelar serviço?",
      description: `${refundHint} O estorno pode levar de 30 a 60 dias para aparecer na fatura.`,
      confirmLabel: "Confirmar cancelamento",
    };
  }

  const penaltyTier = estimateClientPenaltyTier(executionAt);
  const refundHint = describeClientRefundPenalty(penaltyTier);

  return {
    title: "Cancelar serviço?",
    description: `${refundHint} O estorno pode levar de 30 a 60 dias para aparecer na fatura.`,
    confirmLabel: "Confirmar cancelamento",
  };
}

function resolveServiceExecutionAt(input: {
  serviceExecutionAt?: string | Date | null;
  scheduledStartDate: string;
  scheduledShift: string;
}): Date | null {
  if (input.serviceExecutionAt instanceof Date) {
    return Number.isNaN(input.serviceExecutionAt.getTime())
      ? null
      : input.serviceExecutionAt;
  }

  if (typeof input.serviceExecutionAt === "string" && input.serviceExecutionAt.trim()) {
    const parsed = new Date(input.serviceExecutionAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return approximateServiceExecutionAt(input.scheduledStartDate, input.scheduledShift);
}

function describeClientRefundPenalty(
  penaltyTier: ClientRefundPenaltyTier,
  refundAmount?: number,
): string {
  switch (penaltyTier) {
    case "FULL_REFUND":
      return refundAmount != null
        ? `Estimativa de reembolso integral: R$ ${formatAmount(refundAmount)} (valor pago, incluindo taxas de cartão).`
        : "Reembolso integral do valor pago, incluindo taxas de cartão, conforme os Termos de Uso.";
    case "PENALTY_10":
      return refundAmount != null
        ? `Cancelamento com menos de 48 h de antecedência: estimativa de reembolso R$ ${formatAmount(refundAmount)} (penalidade de 10% sobre o valor do serviço). Taxas de cartão não são reembolsadas.`
        : "Cancelamento com menos de 48 h de antecedência: reembolso de 90% do valor do serviço (penalidade de 10%). Taxas de cartão não são reembolsadas.";
    case "PENALTY_30":
      return refundAmount != null
        ? `Cancelamento de última hora: estimativa de reembolso R$ ${formatAmount(refundAmount)} (penalidade de 30% sobre o valor do serviço). Taxas de cartão não são reembolsadas.`
        : "Cancelamento de última hora: reembolso de 70% do valor do serviço (penalidade de 30%). Taxas de cartão não são reembolsadas.";
  }
}

function formatAmount(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
