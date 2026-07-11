import { describe, expect, it } from "vitest";
import { mapRescheduleSnapshot } from "../mapRescheduleSnapshot";

const validSlot = {
  start_date: "2030-06-10",
  end_date: "2030-06-10",
  shift: "morning",
  duration_unit: "hours",
  duration_value: 4,
};

const validActiveRequest = {
  id: "req-1",
  status: "REQUESTED",
  requested_by_role: "client",
  requested_by_profile_id: "profile-1",
  request_note: "Prefer morning",
  original_slot: validSlot,
  original_service_execution_at: "2030-06-10T12:00:00.000Z",
  proposed_slot: null,
  proposed_at: null,
  adjustment_count: 0,
  is_last_minute: false,
  chat_id: "chat-1",
  parent_request_id: null,
};

describe("mapRescheduleSnapshot", () => {
  it("returns null for non-objects or missing contracted_service_id", () => {
    expect(mapRescheduleSnapshot(null)).toBeNull();
    expect(mapRescheduleSnapshot("x")).toBeNull();
    expect(mapRescheduleSnapshot({})).toBeNull();
  });

  it("maps a live snapshot with active_request and capability flags", () => {
    const snapshot = mapRescheduleSnapshot({
      contracted_service_id: "cs-1",
      duration_unit: "hours",
      duration_value: 4,
      active_request: validActiveRequest,
      display_status: "REQUESTED",
      can_client_request_reschedule: true,
      can_provider_request_reschedule: false,
      can_propose_reschedule: false,
      can_accept_reschedule: false,
      can_request_adjustment: false,
      can_cancel_reschedule: true,
    });

    expect(snapshot).toMatchObject({
      contractedServiceId: "cs-1",
      durationUnit: "hours",
      durationValue: 4,
      displayStatus: "REQUESTED",
      canClientRequestReschedule: true,
      canCancelReschedule: true,
    });
    expect(snapshot?.activeRequest?.id).toBe("req-1");
    expect(snapshot?.activeRequest?.original_slot.shift).toBe("morning");
  });

  it("prefers historical request over active_request for card hydration", () => {
    const snapshot = mapRescheduleSnapshot({
      contracted_service_id: "cs-1",
      request: { ...validActiveRequest, id: "req-historical", status: "SUPERSEDED" },
      active_request: { ...validActiveRequest, id: "req-live", status: "PROPOSED" },
    });

    expect(snapshot?.activeRequest?.id).toBe("req-historical");
    expect(snapshot?.activeRequest?.status).toBe("SUPERSEDED");
  });

  it("defaults duration to hours/1 when values are invalid", () => {
    const snapshot = mapRescheduleSnapshot({
      contracted_service_id: "cs-1",
      duration_unit: "weeks",
      duration_value: -1,
      active_request: null,
    });

    expect(snapshot?.durationUnit).toBe("hours");
    expect(snapshot?.durationValue).toBe(1);
  });

  it("rejects active requests with invalid slot or role", () => {
    expect(
      mapRescheduleSnapshot({
        contracted_service_id: "cs-1",
        active_request: {
          ...validActiveRequest,
          original_slot: { start_date: "2030-06-10", shift: "evening" },
        },
      })?.activeRequest,
    ).toBeNull();

    expect(
      mapRescheduleSnapshot({
        contracted_service_id: "cs-1",
        active_request: {
          ...validActiveRequest,
          requested_by_role: "admin",
        },
      })?.activeRequest,
    ).toBeNull();
  });

  it("maps proposed slot duration fields and optional nulls", () => {
    const snapshot = mapRescheduleSnapshot({
      contracted_service_id: "cs-1",
      duration_unit: "days",
      duration_value: 3,
      active_request: {
        ...validActiveRequest,
        status: "PROPOSED",
        proposed_slot: {
          start_date: "2030-06-15",
          end_date: "2030-06-17",
          shift: "full_day",
          duration_unit: "days",
          duration_value: 3,
        },
        proposed_at: "2030-06-01T10:00:00.000Z",
        parent_request_id: "req-parent",
      },
    });

    expect(snapshot?.durationUnit).toBe("days");
    expect(snapshot?.activeRequest?.proposed_slot).toEqual({
      start_date: "2030-06-15",
      end_date: "2030-06-17",
      shift: "full_day",
      duration_unit: "days",
      duration_value: 3,
    });
    expect(snapshot?.activeRequest?.parent_request_id).toBe("req-parent");
  });

  it("rejects active request without status string and defaults optional fields", () => {
    expect(
      mapRescheduleSnapshot({
        contracted_service_id: "cs-1",
        active_request: {
          ...validActiveRequest,
          status: 123,
        },
      })?.activeRequest,
    ).toBeNull();

    const snapshot = mapRescheduleSnapshot({
      contracted_service_id: "cs-1",
      active_request: {
        id: "req-2",
        status: "REQUESTED",
        requested_by_role: "provider",
        original_slot: {
          start_date: "2030-06-10",
          shift: "afternoon",
          duration_unit: "weeks",
          duration_value: 0,
        },
        is_last_minute: 1,
      },
    });

    expect(snapshot?.activeRequest).toMatchObject({
      id: "req-2",
      requested_by_role: "provider",
      request_note: null,
      adjustment_count: 0,
      is_last_minute: true,
      proposed_slot: null,
      proposed_at: null,
      parent_request_id: null,
    });
    expect(snapshot?.activeRequest?.original_slot.duration_unit).toBeNull();
    expect(snapshot?.activeRequest?.original_slot.duration_value).toBeNull();
  });

  it("rejects active request when original_slot has no start_date", () => {
    expect(
      mapRescheduleSnapshot({
        contracted_service_id: "cs-1",
        active_request: {
          ...validActiveRequest,
          original_slot: { shift: "morning" },
        },
      })?.activeRequest,
    ).toBeNull();
  });

  it("returns null activeRequest when id is missing", () => {
    const { id: _id, ...withoutId } = validActiveRequest;
    expect(
      mapRescheduleSnapshot({
        contracted_service_id: "cs-1",
        active_request: withoutId,
      })?.activeRequest,
    ).toBeNull();
  });

  it("maps invalid proposed_slot to null", () => {
    const snapshot = mapRescheduleSnapshot({
      contracted_service_id: "cs-1",
      active_request: {
        ...validActiveRequest,
        proposed_slot: { start_date: "2030-06-15", shift: "evening" },
      },
    });
    expect(snapshot?.activeRequest?.proposed_slot).toBeNull();
  });

  it("returns snapshot without activeRequest when both request keys invalid", () => {
    const snapshot = mapRescheduleSnapshot({
      contracted_service_id: "cs-1",
      request: { id: "bad" },
      active_request: { id: "also-bad" },
      display_status: 42,
    });
    expect(snapshot?.activeRequest).toBeNull();
    expect(snapshot?.displayStatus).toBeNull();
  });

  it("coerces non-string display_status to null", () => {
    expect(
      mapRescheduleSnapshot({
        contracted_service_id: "cs-1",
        display_status: { status: "REQUESTED" },
      })?.displayStatus,
    ).toBeNull();
  });
});
