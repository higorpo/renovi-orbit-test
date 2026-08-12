import { describe, expect, it } from "vitest";
import {
  DEFAULT_EARNINGS_PERIOD,
  EARNINGS_PERIOD,
  parseEarningsPeriod,
} from "../earningsPeriod";
import { getEarningsPeriodRange } from "../../utils/earningsPeriodRange";

describe("parseEarningsPeriod", () => {
  it("defaults to the current month", () => {
    expect(parseEarningsPeriod(null)).toBe(DEFAULT_EARNINGS_PERIOD);
    expect(parseEarningsPeriod("unknown")).toBe(EARNINGS_PERIOD.month);
  });

  it("accepts rolling windows", () => {
    expect(parseEarningsPeriod("3m")).toBe(EARNINGS_PERIOD.threeMonths);
    expect(parseEarningsPeriod("6m")).toBe(EARNINGS_PERIOD.sixMonths);
  });
});

describe("getEarningsPeriodRange", () => {
  const now = new Date("2026-08-12T18:00:00.000Z");

  it("uses the start of the São Paulo month", () => {
    expect(getEarningsPeriodRange("month", now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-12",
    });
  });

  it("rolls back three and six months", () => {
    expect(getEarningsPeriodRange("3m", now)).toEqual({
      from: "2026-05-12",
      to: "2026-08-12",
    });
    expect(getEarningsPeriodRange("6m", now)).toEqual({
      from: "2026-02-12",
      to: "2026-08-12",
    });
  });
});
