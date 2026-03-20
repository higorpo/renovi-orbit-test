import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateProviderServicePricing,
  createProviderProposal,
} from "../providerProposals.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const supabase = await import("@/lib/supabase/client").then((m) => m.supabase);
const logger = await import("@/lib/logger").then((m) => m.logger);
const rpc = vi.mocked(supabase.rpc);

describe("calculateProviderServicePricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pricing when rpc succeeds", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          original_amount: 500,
          tax_rate: 0.15,
          tax_amount: 75,
          final_amount: 425,
          pricing_signature: "sig-123",
        },
      ],
      error: null,
    } as never);

    const result = await calculateProviderServicePricing(500);

    expect(rpc).toHaveBeenCalledWith("calculate_provider_service_pricing", {
      p_original_amount: 500,
    });
    expect(result).toEqual({
      data: {
        original_amount: 500,
        tax_rate: 0.15,
        tax_amount: 75,
        final_amount: 425,
        pricing_signature: "sig-123",
      },
      error: null,
    });
  });

  it("returns error when rpc fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized" },
    } as never);

    const result = await calculateProviderServicePricing(500);

    expect(result).toEqual({
      data: null,
      error: "Unauthorized",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "calculate_provider_service_pricing_error",
      expect.any(Object),
    );
  });
});

describe("createProviderProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates proposal via rpc with pricing signature", async () => {
    rpc.mockResolvedValue({
      data: { id: "proposal-1" },
      error: null,
    } as never);

    const result = await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 500,
      proposalDescription: "Consigo iniciar amanhã cedo.",
      photos: ["providers/p-1/proposals/sr-1/photo-1.jpg"],
      pricing: {
        original_amount: 500,
        tax_rate: 0.15,
        tax_amount: 75,
        final_amount: 425,
        pricing_signature: "sig-123",
      },
    });

    expect(rpc).toHaveBeenCalledWith("create_provider_proposal", {
      p_service_request_id: "sr-1",
      p_proposed_amount: 500,
      p_proposal_description: "Consigo iniciar amanhã cedo.",
      p_photos: ["providers/p-1/proposals/sr-1/photo-1.jpg"],
      p_tax_rate: 0.15,
      p_tax_amount: 75,
      p_final_amount: 425,
      p_pricing_signature: "sig-123",
    });
    expect(result.error).toBeNull();
  });
});
