// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelService,
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

  it("getServiceById rejects blank ids", async () => {
    const result = await getServiceById("  ");
    expect(result).toEqual({ data: null, error: "ID do serviço é obrigatório" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("getServiceById returns RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not found" } });
    const result = await getServiceById("sr-missing");
    expect(result).toEqual({ data: null, error: "not found" });
  });

  it("getServiceById returns null data for non-object payloads", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const result = await getServiceById("sr-1");
    expect(result).toEqual({ data: null, error: null });
  });

  it("listServices returns empty page for dispute tab", async () => {
    const result = await listServices({
      page: 2,
      pageSize: 10,
      statusTabId: "dispute",
    });
    expect(result.data).toEqual({
      items: [],
      total_count: 0,
      page: 2,
      page_size: 10,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("listServices clamps page size and returns list errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await listServices({
      page: 0,
      pageSize: 500,
      statusTabId: "all",
    });
    expect(rpc).toHaveBeenCalledWith(
      "list_services",
      expect.objectContaining({ p_page: 1, p_page_size: 100 }),
    );
    expect(result.error).toBe("boom");
  });

  it("listServices rejects invalid RPC payloads", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const result = await listServices({
      page: 1,
      pageSize: 20,
      statusTabId: "negotiation",
    });
    expect(result.error).toBe("Resposta inválida do servidor");
  });

  it("listServices applies defaults when RPC omits pagination fields", async () => {
    rpc.mockResolvedValue({
      data: {
        items: [
          {
            id: "sr-1",
            list_phase: "negotiation",
            request: { title: "Job" },
            negotiation: { proposal_count: 0, has_pending_proposal: false },
          },
        ],
      },
      error: null,
    });

    const result = await listServices({
      page: 1,
      pageSize: 20,
      statusTabId: "negotiation",
    });

    expect(result.data).toMatchObject({
      total_count: 1,
      page: 1,
      page_size: 1,
    });
    expect(result.data?.items).toHaveLength(1);
  });

  it("listServices focused mode returns empty when service is missing", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const result = await listServices({
      page: 1,
      pageSize: 20,
      statusTabId: "all",
      serviceRequestId: "sr-gone",
    });
    expect(result.data).toEqual({
      items: [],
      total_count: 0,
      page: 1,
      page_size: 20,
    });
  });

  it("listServices focused mode propagates get_service errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    const result = await listServices({
      page: 1,
      pageSize: 20,
      statusTabId: "all",
      serviceRequestId: "sr-x",
    });
    expect(result.error).toBe("denied");
  });

  it("cancelService rejects blank ids and succeeds on RPC ok", async () => {
    expect(await cancelService(" ")).toEqual({
      error: "ID do serviço é obrigatório",
    });

    rpc.mockResolvedValue({ data: null, error: null });
    vi.spyOn(crypto, "randomUUID").mockReturnValue("uuid-1");
    const ok = await cancelService("sr-1");
    expect(rpc).toHaveBeenCalledWith("cancel_service_request", {
      p_service_request_id: "sr-1",
      p_idempotency_key: "uuid-1",
    });
    expect(ok.error).toBeNull();
  });

  it("cancelService returns RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "cannot cancel" } });
    const result = await cancelService("sr-1");
    expect(result.error).toBe("cannot cancel");
  });

  it("republishCancelledServiceRequest validates inputs and payloads", async () => {
    expect(await republishCancelledServiceRequest(" ", "idem")).toEqual({
      data: null,
      error: "ID do serviço é obrigatório",
    });
    expect(await republishCancelledServiceRequest("sr-1", "  ")).toEqual({
      data: null,
      error: "Chave de idempotência é obrigatória",
    });

    rpc.mockResolvedValue({ data: [], error: null });
    expect(await republishCancelledServiceRequest("sr-1", "idem")).toEqual({
      data: null,
      error: "Resposta inválida do servidor",
    });

    rpc.mockResolvedValue({ data: { sourceRequestId: "sr-1" }, error: null });
    expect(await republishCancelledServiceRequest("sr-1", "idem")).toEqual({
      data: null,
      error: "Resposta inválida do servidor",
    });

    rpc.mockResolvedValue({
      data: { requestId: "sr-new" },
      error: null,
    });
    expect(await republishCancelledServiceRequest("sr-1", "idem")).toEqual({
      data: { requestId: "sr-new", sourceRequestId: "sr-1" },
      error: null,
    });
  });
});
