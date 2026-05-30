// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { trackEvent } = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}));

import { useChatAnalytics } from "../useChatAnalytics";

describe("useChatAnalytics", () => {
  it("tracks post-confirm proposal events with schema v1", () => {
    const { result } = renderHook(() => useChatAnalytics());

    result.current.proposal_submitted({
      proposal_id: "proposal-1",
      chat_id: "chat-1",
      service_request_id: "sr-1",
      version: 2,
      revision_count: 1,
      time_to_proposal_ms: 1200,
    });

    expect(trackEvent).toHaveBeenCalledWith("proposal_submitted", {
      event: "proposal_submitted",
      schema_version: "v1",
      proposal_id: "proposal-1",
      chat_id: "chat-1",
      service_request_id: "sr-1",
      version: 2,
      revision_count: 1,
      time_to_proposal_ms: 1200,
    });
  });
});
