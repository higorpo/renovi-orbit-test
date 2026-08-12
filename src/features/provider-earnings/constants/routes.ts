import {
  EARNINGS_VIEW,
  EARNINGS_VIEW_SEARCH_PARAM,
  type EarningsView,
} from "./earningsView";

/** Canonical Ganhos path (hosted under Configurações hub). */
export const ROUTE_PROVIDER_EARNINGS = "/dashboard/settings/earnings";

/** Ganhos with the Cobranças (capture) panel open. */
export function providerEarningsPath(view?: EarningsView): string {
  if (view === EARNINGS_VIEW.charges) {
    return `${ROUTE_PROVIDER_EARNINGS}?${EARNINGS_VIEW_SEARCH_PARAM}=${EARNINGS_VIEW.charges}`;
  }
  return ROUTE_PROVIDER_EARNINGS;
}
