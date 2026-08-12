import { describe, expect, it } from "vitest";
import { summarizeProviderReceivables } from "../summarizeProviderReceivables";

describe("summarizeProviderReceivables", () => {
  it("returns zeros for an empty list", () => {
    expect(summarizeProviderReceivables([])).toEqual({
      agreedTotal: 0,
      netTotal: 0,
      count: 0,
      hasClawback: false,
    });
  });

  it("sums agreed capture and net amounts", () => {
    expect(
      summarizeProviderReceivables([
        { amountReceivedAtCapture: 1000, netAmountReceived: 1000 },
        { amountReceivedAtCapture: 250.5, netAmountReceived: 200.25 },
      ]),
    ).toEqual({
      agreedTotal: 1250.5,
      netTotal: 1200.25,
      count: 2,
      hasClawback: true,
    });
  });

  it("flags no clawback when agreed and net match", () => {
    expect(
      summarizeProviderReceivables([{ amountReceivedAtCapture: 90, netAmountReceived: 90 }]),
    ).toEqual({
      agreedTotal: 90,
      netTotal: 90,
      count: 1,
      hasClawback: false,
    });
  });
});
