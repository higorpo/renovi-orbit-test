import { describe, expect, it } from "vitest";
import {
  deriveServiceRequestListPhase,
  normalizeServiceRequestStatus,
} from "../serviceRequestListPhase";

describe("serviceRequestListPhase", () => {
  it("normalizes status case", () => {
    expect(normalizeServiceRequestStatus("open")).toBe("OPEN");
    expect(normalizeServiceRequestStatus(" COMPLETED ")).toBe("COMPLETED");
  });

  it("derives negotiation for open SR without contracted service", () => {
    expect(
      deriveServiceRequestListPhase({ status: "OPEN", contractedServiceId: null }),
    ).toBe("negotiation");
  });

  it("derives in_progress when contracted service exists", () => {
    expect(
      deriveServiceRequestListPhase({
        status: "OPEN",
        contractedServiceId: "svc-1",
      }),
    ).toBe("in_progress");
  });

  it("derives completed and cancelled from SR status", () => {
    expect(
      deriveServiceRequestListPhase({ status: "COMPLETED", contractedServiceId: "svc-1" }),
    ).toBe("completed");
    expect(
      deriveServiceRequestListPhase({ status: "CANCELLED", contractedServiceId: null }),
    ).toBe("cancelled");
  });
});
