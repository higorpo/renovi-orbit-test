import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptServiceReschedule,
  cancelServiceRescheduleRequest,
  getActiveServiceRescheduleForChat,
  getServiceRescheduleRequest,
  proposeServiceReschedule,
  requestRescheduleAdjustment,
  requestServiceReschedule,
} from "../serviceReschedule.api";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => "00000000-0000-7000-8000-000000000001",
}));

const snapshotPayload = {
  contracted_service_id: "cs-1",
  duration_unit: "hours",
  duration_value: 4,
  active_request: {
    id: "req-1",
    status: "REQUESTED",
    requested_by_role: "client",
    requested_by_profile_id: "profile-1",
    request_note: null,
    original_slot: { start_date: "2030-06-10", shift: "morning" },
    original_service_execution_at: "2030-06-10T12:00:00.000Z",
    proposed_slot: null,
    proposed_at: null,
    adjustment_count: 0,
    is_last_minute: false,
    chat_id: "chat-1",
    parent_request_id: null,
  },
  display_status: "REQUESTED",
  can_client_request_reschedule: false,
  can_provider_request_reschedule: false,
  can_propose_reschedule: true,
  can_accept_reschedule: false,
  can_request_adjustment: false,
  can_cancel_reschedule: true,
};

const mutationPayload = {
  reschedule_request_id: "req-1",
  chat_id: "chat-1",
  deep_link_path: "/dashboard/chats/chat-1",
  reschedule: snapshotPayload,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServiceRescheduleRequest", () => {
  it("returns mapped snapshot on success", async () => {
    rpcMock.mockResolvedValue({ data: snapshotPayload, error: null });

    const result = await getServiceRescheduleRequest("req-1");

    expect(rpcMock).toHaveBeenCalledWith("cns_get_service_reschedule_request", {
      p_reschedule_request_id: "req-1",
    });
    expect(result.error).toBeNull();
    expect(result.data?.contractedServiceId).toBe("cs-1");
    expect(result.data?.activeRequest?.id).toBe("req-1");
  });

  it("maps RPC business errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "RESCHEDULE_REQUEST_NOT_FOUND" },
    });

    const result = await getServiceRescheduleRequest("missing");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("RESCHEDULE_REQUEST_NOT_FOUND");
  });

  it("rejects invalid response shapes", async () => {
    rpcMock.mockResolvedValue({ data: { foo: "bar" }, error: null });

    const result = await getServiceRescheduleRequest("req-1");

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("inesperada");
  });
});

describe("getActiveServiceRescheduleForChat", () => {
  it("returns null data when chat has no active reschedule", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await getActiveServiceRescheduleForChat("chat-1");

    expect(rpcMock).toHaveBeenCalledWith("cns_get_active_service_reschedule_for_chat", {
      p_chat_id: "chat-1",
    });
    expect(result).toEqual({ data: null, error: null });
  });

  it("returns mapped snapshot when active request exists", async () => {
    rpcMock.mockResolvedValue({ data: snapshotPayload, error: null });

    const result = await getActiveServiceRescheduleForChat("chat-1");

    expect(result.error).toBeNull();
    expect(result.data?.activeRequest?.chat_id).toBe("chat-1");
  });

  it("propagates RPC errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "CHAT_NOT_FOUND" },
    });

    const result = await getActiveServiceRescheduleForChat("chat-x");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("CHAT_NOT_FOUND");
  });
});

describe("requestServiceReschedule", () => {
  it("calls request RPC with idempotency key and note", async () => {
    rpcMock.mockResolvedValue({ data: mutationPayload, error: null });

    const result = await requestServiceReschedule({
      contractedServiceId: "cs-1",
      requestNote: "Prefer afternoon",
      idempotencyKey: "idem-custom",
    });

    expect(rpcMock).toHaveBeenCalledWith("cns_request_service_reschedule", {
      p_contracted_service_id: "cs-1",
      p_idempotency_key: "idem-custom",
      p_request_note: "Prefer afternoon",
    });
    expect(result.error).toBeNull();
    expect(result.data?.reschedule_request_id).toBe("req-1");
    expect(result.data?.reschedule?.contractedServiceId).toBe("cs-1");
  });

  it("generates idempotency key and null note by default", async () => {
    rpcMock.mockResolvedValue({ data: mutationPayload, error: null });

    await requestServiceReschedule({ contractedServiceId: "cs-1" });

    expect(rpcMock).toHaveBeenCalledWith(
      "cns_request_service_reschedule",
      expect.objectContaining({
        p_idempotency_key: "00000000-0000-7000-8000-000000000001",
        p_request_note: null,
      }),
    );
  });

  it("returns mapped error without normalizing data", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "ACTIVE_RESCHEDULE_EXISTS" },
    });

    const result = await requestServiceReschedule({ contractedServiceId: "cs-1" });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("ACTIVE_RESCHEDULE_EXISTS");
  });
});

describe("propose / accept / adjustment / cancel mutations", () => {
  const slot = {
    start_date: "2030-06-20",
    end_date: null,
    shift: "morning" as const,
    duration_unit: "hours" as const,
    duration_value: 4,
  };

  it("proposeServiceReschedule passes slot and key", async () => {
    rpcMock.mockResolvedValue({ data: mutationPayload, error: null });

    const result = await proposeServiceReschedule({
      rescheduleRequestId: "req-1",
      newSlot: slot,
      idempotencyKey: "idem-propose",
    });

    expect(rpcMock).toHaveBeenCalledWith("cns_propose_service_reschedule", {
      p_reschedule_request_id: "req-1",
      p_new_slot: slot,
      p_idempotency_key: "idem-propose",
    });
    expect(result.error).toBeNull();
    expect(result.data?.chat_id).toBe("chat-1");
  });

  it("acceptServiceReschedule normalizes mutation response", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ...mutationPayload,
        superseded_request_id: "req-old",
        superseded_reschedule: {
          ...snapshotPayload,
          active_request: { ...snapshotPayload.active_request, id: "req-old", status: "SUPERSEDED" },
        },
      },
      error: null,
    });

    const result = await acceptServiceReschedule({
      rescheduleRequestId: "req-1",
      idempotencyKey: "idem-accept",
    });

    expect(rpcMock).toHaveBeenCalledWith("cns_accept_service_reschedule", {
      p_reschedule_request_id: "req-1",
      p_idempotency_key: "idem-accept",
    });
    expect(result.data?.superseded_request_id).toBe("req-old");
    expect(result.data?.superseded_reschedule?.activeRequest?.id).toBe("req-old");
  });

  it("requestRescheduleAdjustment and cancelServiceRescheduleRequest call their RPCs", async () => {
    rpcMock.mockResolvedValue({ data: mutationPayload, error: null });

    await requestRescheduleAdjustment({
      rescheduleRequestId: "req-1",
      idempotencyKey: "idem-adj",
    });
    await cancelServiceRescheduleRequest({
      rescheduleRequestId: "req-1",
      idempotencyKey: "idem-cancel",
    });

    expect(rpcMock).toHaveBeenNthCalledWith(1, "cns_request_reschedule_adjustment", {
      p_reschedule_request_id: "req-1",
      p_idempotency_key: "idem-adj",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "cns_cancel_service_reschedule_request", {
      p_reschedule_request_id: "req-1",
      p_idempotency_key: "idem-cancel",
    });
  });

  it("normalizes empty mutation payloads to null reschedule", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    // isMutationResponse(null) is false → invalid response path
    const invalid = await acceptServiceReschedule({ rescheduleRequestId: "req-1" });
    expect(invalid.error?.message).toContain("inesperada");

    rpcMock.mockResolvedValue({ data: {}, error: null });
    const empty = await cancelServiceRescheduleRequest({ rescheduleRequestId: "req-1" });
    expect(empty.error).toBeNull();
    expect(empty.data?.reschedule).toBeNull();
  });

  it("normalizes non-string optional mutation fields to undefined", async () => {
    rpcMock.mockResolvedValue({
      data: {
        reschedule_request_id: 1,
        superseded_request_id: null,
        chat_id: false,
        deep_link_path: 3,
        reschedule: null,
      },
      error: null,
    });

    const result = await proposeServiceReschedule({
      rescheduleRequestId: "req-1",
      newSlot: {
        start_date: "2030-06-20",
        end_date: null,
        shift: "morning",
        duration_unit: "hours",
        duration_value: 4,
      },
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      reschedule_request_id: undefined,
      superseded_request_id: undefined,
      chat_id: undefined,
      deep_link_path: undefined,
      reschedule: null,
      superseded_reschedule: null,
    });
  });
});
