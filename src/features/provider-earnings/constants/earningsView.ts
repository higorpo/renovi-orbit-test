export const EARNINGS_VIEW = {
  deposits: "deposits",
  charges: "charges",
} as const;

export type EarningsView = (typeof EARNINGS_VIEW)[keyof typeof EARNINGS_VIEW];

export const DEFAULT_EARNINGS_VIEW: EarningsView = EARNINGS_VIEW.deposits;

export const EARNINGS_VIEW_SEARCH_PARAM = "view";

export function parseEarningsView(value: string | null | undefined): EarningsView {
  return value === EARNINGS_VIEW.charges ? EARNINGS_VIEW.charges : EARNINGS_VIEW.deposits;
}
