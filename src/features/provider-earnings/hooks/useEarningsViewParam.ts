import { useCallback } from "react";
import { useSearchParams } from "react-router";
import {
  DEFAULT_EARNINGS_PERIOD,
  EARNINGS_PERIOD_SEARCH_PARAM,
  parseEarningsPeriod,
  type EarningsPeriod,
} from "../constants/earningsPeriod";
import {
  DEFAULT_EARNINGS_VIEW,
  EARNINGS_VIEW,
  EARNINGS_VIEW_SEARCH_PARAM,
  parseEarningsView,
  type EarningsView,
} from "../constants/earningsView";

export function useEarningsViewParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseEarningsView(searchParams.get(EARNINGS_VIEW_SEARCH_PARAM));
  const period = parseEarningsPeriod(searchParams.get(EARNINGS_PERIOD_SEARCH_PARAM));

  const patchParams = useCallback(
    (patch: { view?: EarningsView; period?: EarningsPeriod }) => {
      setSearchParams(
        (current) => {
          const nextParams = new URLSearchParams(current);
          const nextView = patch.view ?? parseEarningsView(nextParams.get(EARNINGS_VIEW_SEARCH_PARAM));
          const nextPeriod = patch.period ?? parseEarningsPeriod(nextParams.get(EARNINGS_PERIOD_SEARCH_PARAM));

          if (nextView === DEFAULT_EARNINGS_VIEW) {
            nextParams.delete(EARNINGS_VIEW_SEARCH_PARAM);
          } else {
            nextParams.set(EARNINGS_VIEW_SEARCH_PARAM, EARNINGS_VIEW.charges);
          }

          if (nextPeriod === DEFAULT_EARNINGS_PERIOD) {
            nextParams.delete(EARNINGS_PERIOD_SEARCH_PARAM);
          } else {
            nextParams.set(EARNINGS_PERIOD_SEARCH_PARAM, nextPeriod);
          }

          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setView = useCallback(
    (next: EarningsView) => {
      patchParams({ view: next });
    },
    [patchParams],
  );

  const setPeriod = useCallback(
    (next: EarningsPeriod) => {
      patchParams({ period: next });
    },
    [patchParams],
  );

  return { view, setView, period, setPeriod };
}
