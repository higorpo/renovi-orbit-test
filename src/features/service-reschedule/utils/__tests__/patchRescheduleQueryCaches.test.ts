// @vitest-environment happy-dom
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_ACTIVE_RESCHEDULE_QUERY_KEY } from "../../hooks/useActiveChatReschedule";
import { CHAT_RESCHEDULE_TIMELINE_QUERY_KEY } from "../../hooks/useRescheduleTimelineHydration";
import { SERVICE_RESCHEDULE_REQUEST_QUERY_KEY } from "../../hooks/useRescheduleRequestDetail";
import type { ServiceRescheduleSnapshot } from "../../types/serviceReschedule.types";
import { patchRescheduleQueryCaches } from "../patchRescheduleQueryCaches";

function buildSnapshot(
  overrides: Partial<ServiceRescheduleSnapshot> & {
    activeRequest?: ServiceRescheduleSnapshot["activeRequest"];
  } = {},
): ServiceRescheduleSnapshot {
  return {
    contractedServiceId: "cs-1",
    durationUnit: "hours",
    durationValue: 4,
    activeRequest: {
      id: "req-1",
      status: "REQUESTED",
      requested_by_role: "client",
      requested_by_profile_id: "p-1",
      request_note: null,
      original_slot: { start_date: "2030-06-10", shift: "morning" },
      original_service_execution_at: "2030-06-10T12:00:00.000Z",
      proposed_slot: null,
      proposed_at: null,
      adjustment_count: 0,
      is_last_minute: false,
      chat_id: "chat-from-request",
      parent_request_id: null,
    },
    displayStatus: "REQUESTED",
    canClientRequestReschedule: false,
    canProviderRequestReschedule: false,
    canProposeReschedule: false,
    canAcceptReschedule: false,
    canRequestAdjustment: false,
    canCancelReschedule: true,
    ...overrides,
  };
}

describe("patchRescheduleQueryCaches", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it("writes active chat cache using chatId or request chat_id", () => {
    const snapshot = buildSnapshot();

    patchRescheduleQueryCaches(queryClient, null, snapshot);

    expect(queryClient.getQueryData([CHAT_ACTIVE_RESCHEDULE_QUERY_KEY, "chat-from-request"])).toBe(
      snapshot,
    );
    expect(queryClient.getQueryData([SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, "req-1"])).toBe(
      snapshot,
    );
    expect(
      queryClient.getQueryData([
        CHAT_RESCHEDULE_TIMELINE_QUERY_KEY,
        "chat-from-request",
        "req-1",
      ]),
    ).toBe(snapshot);
  });

  it("stops after active cache when snapshot has no request id", () => {
    const snapshot = buildSnapshot({ activeRequest: null });

    patchRescheduleQueryCaches(queryClient, "chat-1", snapshot);

    expect(queryClient.getQueryData([CHAT_ACTIVE_RESCHEDULE_QUERY_KEY, "chat-1"])).toBe(snapshot);
    expect(queryClient.getQueryData([SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, "req-1"])).toBeUndefined();
  });

  it("writes superseded snapshot caches when provided", () => {
    const snapshot = buildSnapshot();
    const superseded = buildSnapshot({
      activeRequest: {
        ...snapshot.activeRequest!,
        id: "req-old",
        status: "SUPERSEDED",
      },
    });

    patchRescheduleQueryCaches(queryClient, "chat-1", snapshot, {
      supersededRequestId: "req-old",
      supersededSnapshot: superseded,
    });

    expect(queryClient.getQueryData([SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, "req-old"])).toBe(
      superseded,
    );
    expect(
      queryClient.getQueryData([CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, "chat-1", "req-old"]),
    ).toBe(superseded);
  });

  it("invalidates superseded caches when snapshot for old request is missing", () => {
    const snapshot = buildSnapshot();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    patchRescheduleQueryCaches(queryClient, "chat-1", snapshot, {
      supersededRequestId: "req-old",
      supersededSnapshot: null,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, "chat-1", "req-old"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, "req-old"],
    });
  });
});
