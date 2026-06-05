import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestProviderProposalForServiceRequest } from "../proposals.api";

const { maybeSingle } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

describe("getLatestProviderProposalForServiceRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped latest proposal", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: "prop-1",
        service_request_id: "sr-1",
        status: "PENDING",
        proposed_amount: 300,
        tax_rate: 0.1,
        tax_amount: 30,
        proposal_description: "Work scope",
        photos: [],
        client_rejection_response: null,
        revision_reason: null,
        revision_notes: null,
        proposal_duration_value: 1,
        proposal_duration_unit: "days",
        proposal_suggested_slots: [],
        version: 1,
      },
      error: null,
    });

    const result = await getLatestProviderProposalForServiceRequest({
      serviceRequestId: "sr-1",
      providerId: "provider-1",
    });

    expect(result.error).toBeNull();
    expect(result.data?.summary.proposalId).toBe("prop-1");
    expect(result.data?.summary.isLatestProposal).toBe(true);
  });

  it("returns null when no proposal exists", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getLatestProviderProposalForServiceRequest({
      serviceRequestId: "sr-1",
      providerId: "provider-1",
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns error message on PostgREST failure", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    const result = await getLatestProviderProposalForServiceRequest({
      serviceRequestId: "sr-1",
      providerId: "provider-1",
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("permission denied");
  });
});
