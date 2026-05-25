import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestDispatch } from "../dispatchIngest.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const invokeMock = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ingestDispatch", () => {
  it("invokes message-dispatcher-ingest edge function", async () => {
    invokeMock.mockResolvedValue({
      data: {
        dispatch_id: "d1",
        status: "QUEUED",
        scheduled_for: "2026-05-22T10:00:00Z",
        duplicate: false,
      },
      error: null,
    });

    const { result, error } = await ingestDispatch({
      profileId: "user-1",
      channel: "email",
      templateKey: "welcome_template",
      idempotencyKey: "018f0000-0000-7000-8000-000000000001",
    });

    expect(error).toBeNull();
    expect(result?.dispatchId).toBe("d1");
    expect(invokeMock).toHaveBeenCalledWith(
      "message-dispatcher-ingest",
      expect.objectContaining({
        body: expect.objectContaining({
          profileId: "user-1",
          channel: "email",
        }),
      }),
    );
  });
});
