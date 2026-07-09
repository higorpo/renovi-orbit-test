// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getServiceById,
  listServices,
  republishCancelledServiceRequest,
} from "../services.api";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc },
}));

describe("services.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getServiceById calls get_service RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "sr-1",
        list_phase: "negotiation",
        request: { title: "Job" },
        negotiation: { proposal_count: 0, has_pending_proposal: false },
      },
      error: null,
    });

    const result = await getServiceById("sr-1");
    expect(rpc).toHaveBeenCalledWith("get_service", { p_service_request_id: "sr-1" });
    expect(result.data?.id).toBe("sr-1");
    expect(result.error).toBeNull();
  });

  it("listServices calls list_services RPC with phase filter", async () => {
    rpc.mockResolvedValue({
      data: { items: [], total_count: 0, page: 1, page_size: 20 },
      error: null,
    });

    await listServices({
      page: 1,
      pageSize: 20,
      statusTabId: "negotiation",
      search: "foo",
    });

    expect(rpc).toHaveBeenCalledWith(
      "list_services",
      expect.objectContaining({
        p_page: 1,
        p_page_size: 20,
        p_list_phase: "negotiation",
        p_search: "foo",
      }),
    );
  });

  it("listServices uses get_service when serviceRequestId focus is set", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "sr-focus",
        list_phase: "negotiation",
        request: { title: "Focused" },
        negotiation: { proposal_count: 0, has_pending_proposal: false },
      },
      error: null,
    });

    const result = await listServices({
      page: 1,
      pageSize: 20,
      statusTabId: "all",
      serviceRequestId: "sr-focus",
    });

    expect(rpc).toHaveBeenCalledWith("get_service", { p_service_request_id: "sr-focus" });
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.total_count).toBe(1);
  });

  it("republishCancelledServiceRequest calls RPC with idempotency key", async () => {
    rpc.mockResolvedValue({
      data: { requestId: "sr-new", sourceRequestId: "sr-old" },
      error: null,
    });

    const result = await republishCancelledServiceRequest("sr-old", "idem-1");

    expect(rpc).toHaveBeenCalledWith("republish_cancelled_service_request", {
      p_service_request_id: "sr-old",
      p_idempotency_key: "idem-1",
    });
    expect(result.data).toEqual({ requestId: "sr-new", sourceRequestId: "sr-old" });
    expect(result.error).toBeNull();
  });

  it("republishCancelledServiceRequest returns error from RPC", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "SR_NOT_CANCELLED" },
    });

    const result = await republishCancelledServiceRequest("sr-open", "idem-2");

    expect(result.data).toBeNull();
    expect(result.error).toBe("SR_NOT_CANCELLED");
  });
});
