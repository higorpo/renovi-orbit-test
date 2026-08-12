import { useCallback } from "react";
import { useSearchParams } from "react-router";
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

  const setView = useCallback(
    (next: EarningsView) => {
      setSearchParams(
        (current) => {
          const nextParams = new URLSearchParams(current);
          if (next === DEFAULT_EARNINGS_VIEW) {
            nextParams.delete(EARNINGS_VIEW_SEARCH_PARAM);
          } else {
            nextParams.set(EARNINGS_VIEW_SEARCH_PARAM, EARNINGS_VIEW.charges);
          }
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { view, setView };
}
