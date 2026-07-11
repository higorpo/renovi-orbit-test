import { describe, expect, it } from "vitest";
import {
  canEditServiceRequestProposal,
  hasActiveServiceRequestProposal,
  isPendingProposalStatus,
  isRejectedProposalStatus,
  normalizeProposalStatus,
  resolveProposalStatus,
} from "../proposalStatus";

describe("normalizeProposalStatus", () => {
  it("trims and uppercases status values", () => {
    expect(normalizeProposalStatus(" pending ")).toBe("PENDING");
    expect(normalizeProposalStatus(null)).toBe("");
    expect(normalizeProposalStatus(undefined)).toBe("");
  });
});

describe("resolveProposalStatus", () => {
  it("coerces known statuses and rejects unknown ones", () => {
    expect(resolveProposalStatus("accepted")).toBe("ACCEPTED");
    expect(resolveProposalStatus("unknown")).toBeNull();
  });
});

describe("canEditServiceRequestProposal", () => {
  it("allows edit for PENDING and REVISION_REQUESTED", () => {
    expect(canEditServiceRequestProposal("PENDING")).toBe(true);
    expect(canEditServiceRequestProposal("REVISION_REQUESTED")).toBe(true);
  });

  it("disallows edit for terminal or non-editable statuses", () => {
    expect(canEditServiceRequestProposal("ACCEPTED")).toBe(false);
    expect(canEditServiceRequestProposal("REVISED")).toBe(false);
    expect(canEditServiceRequestProposal("REJECTED")).toBe(false);
    expect(canEditServiceRequestProposal("REJECTED_AUTOMATICALLY")).toBe(false);
    expect(canEditServiceRequestProposal("EXPIRED")).toBe(false);
    expect(canEditServiceRequestProposal(null)).toBe(false);
  });
});

describe("hasActiveServiceRequestProposal", () => {
  it("treats REVISED as inactive", () => {
    expect(hasActiveServiceRequestProposal("prop-1", "REVISED")).toBe(false);
  });

  it("treats PENDING as active when proposal id exists", () => {
    expect(hasActiveServiceRequestProposal("prop-1", "PENDING")).toBe(true);
  });

  it("returns false when proposal id is missing", () => {
    expect(hasActiveServiceRequestProposal(null, "PENDING")).toBe(false);
    expect(hasActiveServiceRequestProposal(undefined, "PENDING")).toBe(false);
    expect(hasActiveServiceRequestProposal("", "PENDING")).toBe(false);
  });
});

describe("isRejectedProposalStatus", () => {
  it("matches rejected statuses", () => {
    expect(isRejectedProposalStatus("REJECTED")).toBe(true);
    expect(isRejectedProposalStatus("REJECTED_AUTOMATICALLY")).toBe(true);
    expect(isRejectedProposalStatus("PENDING")).toBe(false);
  });
});

describe("isPendingProposalStatus", () => {
  it("matches pending statuses", () => {
    expect(isPendingProposalStatus("PENDING")).toBe(true);
    expect(isPendingProposalStatus("submitted")).toBe(false);
    expect(isPendingProposalStatus("REVISION_REQUESTED")).toBe(false);
  });
});
