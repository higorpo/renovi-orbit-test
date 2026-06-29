const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export type ChargeTimingDisclosure =
  | {
      kind: "emergency";
      message: string;
    }
  | {
      kind: "scheduled";
      chargeScheduledAt: Date;
      message: string;
    };

export function computeChargeScheduledAt(
  serviceScheduledAt: Date,
  now = new Date(),
): Date {
  const msUntilService = serviceScheduledAt.getTime() - now.getTime();

  if (msUntilService < FORTY_EIGHT_HOURS_MS) {
    return now;
  }

  return new Date(serviceScheduledAt.getTime() - TWO_DAYS_MS);
}

export function formatChargeDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getChargeTimingDisclosure(
  serviceScheduledAt: Date,
  now = new Date(),
): ChargeTimingDisclosure {
  const msUntilService = serviceScheduledAt.getTime() - now.getTime();

  if (msUntilService < FORTY_EIGHT_HOURS_MS) {
    return {
      kind: "emergency",
      message: "A cobrança será processada nas próximas horas.",
    };
  }

  const chargeScheduledAt = computeChargeScheduledAt(serviceScheduledAt, now);

  return {
    kind: "scheduled",
    chargeScheduledAt,
    message: `A cobrança está prevista para ${formatChargeDate(chargeScheduledAt)}.`,
  };
}
