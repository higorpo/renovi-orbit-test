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

  it("derives negotiation for OPEN service requests", () => {
    expect(
      deriveServiceRequestListPhase({ status: "OPEN", contractedServiceStatus: null }),
    ).toBe("negotiation");
  });

  it("derives in_progress for COMPLETED SR with non-terminal contracted service", () => {
    expect(
      deriveServiceRequestListPhase({
        status: "COMPLETED",
        contractedServiceStatus: "PENDING_PAYMENT",
      }),
    ).toBe("in_progress");
  });

  it("derives completed when both SR and contracted service are COMPLETED", () => {
    expect(
      deriveServiceRequestListPhase({
        status: "COMPLETED",
        contractedServiceStatus: "COMPLETED",
      }),
    ).toBe("completed");
  });

  it("derives cancelled from SR status or cancelled contracted service", () => {
    expect(
      deriveServiceRequestListPhase({ status: "CANCELLED", contractedServiceStatus: null }),
    ).toBe("cancelled");
    expect(
      deriveServiceRequestListPhase({
        status: "COMPLETED",
        contractedServiceStatus: "CANCELLED",
      }),
    ).toBe("cancelled");
  });
});
