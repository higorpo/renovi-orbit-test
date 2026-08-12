export const EARNINGS_PERIOD = {
  month: "month",
  threeMonths: "3m",
  sixMonths: "6m",
} as const;

export type EarningsPeriod = (typeof EARNINGS_PERIOD)[keyof typeof EARNINGS_PERIOD];

export const DEFAULT_EARNINGS_PERIOD: EarningsPeriod = EARNINGS_PERIOD.month;

export const EARNINGS_PERIOD_SEARCH_PARAM = "period";

export const EARNINGS_PERIOD_TABS: Array<{ id: EarningsPeriod; label: string }> = [
  { id: EARNINGS_PERIOD.month, label: "Este mês" },
  { id: EARNINGS_PERIOD.threeMonths, label: "3 meses" },
  { id: EARNINGS_PERIOD.sixMonths, label: "6 meses" },
];

export function parseEarningsPeriod(value: string | null | undefined): EarningsPeriod {
  if (value === EARNINGS_PERIOD.threeMonths || value === EARNINGS_PERIOD.sixMonths) {
    return value;
  }
  return DEFAULT_EARNINGS_PERIOD;
}
