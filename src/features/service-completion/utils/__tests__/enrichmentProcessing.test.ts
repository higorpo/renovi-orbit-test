import { describe, expect, it } from "vitest";
import { deriveEnrichmentProcessingUi } from "../enrichmentProcessing";

describe("deriveEnrichmentProcessingUi", () => {
  it("maps PENDING/RUNNING to processing with poll", () => {
    expect(deriveEnrichmentProcessingUi({ enrichmentStatus: "PENDING" })).toMatchObject({
      kind: "processing",
      shouldPoll: true,
    });
    expect(deriveEnrichmentProcessingUi({ enrichmentStatus: "RUNNING" })).toMatchObject({
      kind: "processing",
      shouldPoll: true,
    });
  });

  it("hides when READY (status or enrichmentReady flag)", () => {
    expect(
      deriveEnrichmentProcessingUi({ enrichmentStatus: "READY" }),
    ).toMatchObject({ kind: "hidden", shouldPoll: false });
    expect(
      deriveEnrichmentProcessingUi({
        enrichmentStatus: "PENDING",
        enrichmentReady: true,
      }),
    ).toMatchObject({ kind: "hidden", shouldPoll: false });
  });

  it("maps ABORTED without inventing a request status", () => {
    expect(deriveEnrichmentProcessingUi({ enrichmentStatus: "ABORTED" })).toMatchObject({
      kind: "aborted",
      shouldPoll: false,
    });
  });

  it("prioritizes cancelled request over enrichment FSM", () => {
    expect(
      deriveEnrichmentProcessingUi({
        enrichmentStatus: "RUNNING",
        requestStatus: "CANCELLED",
      }),
    ).toMatchObject({ kind: "cancelled", shouldPoll: false });
    expect(
      deriveEnrichmentProcessingUi({
        enrichmentStatus: "PENDING",
        listPhase: "cancelled",
      }),
    ).toMatchObject({ kind: "cancelled", shouldPoll: false });
  });

  it("hides when enrichment has not started", () => {
    expect(
      deriveEnrichmentProcessingUi({ enrichmentStatus: null }),
    ).toMatchObject({ kind: "hidden", shouldPoll: false });
  });
});
