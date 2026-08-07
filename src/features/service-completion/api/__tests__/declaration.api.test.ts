import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordExecutionDeclaration } from "../declaration.api";
import { logger } from "@/lib/logger";

const mockInvoke = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("recordExecutionDeclaration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes record-service-completion-declaration with device fields", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        id: "decl-1",
        contractedServiceId: "cs-1",
        declaredAt: "2026-08-07T12:00:00Z",
        lastSeenAt: "2026-08-07T12:00:00Z",
      },
      error: null,
    });

    const result = await recordExecutionDeclaration({
      contractedServiceId: "cs-1",
      deviceId: "d1",
      platform: "web",
      operatingSystem: "linux",
      osVersion: null,
      manufacturer: null,
      model: null,
      deviceName: null,
      isVirtual: false,
      webViewVersion: null,
      userAgent: "ua",
      clientTimezone: "America/Sao_Paulo",
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "record-service-completion-declaration",
      expect.objectContaining({
        body: expect.objectContaining({
          contractedServiceId: "cs-1",
          deviceId: "d1",
          platform: "web",
          clientTimezone: "America/Sao_Paulo",
        }),
      }),
    );
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("decl-1");
  });

  it("returns error when invoke fails", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "network" },
    });

    const result = await recordExecutionDeclaration({
      contractedServiceId: "cs-1",
      deviceId: null,
      platform: "web",
      operatingSystem: null,
      osVersion: null,
      manufacturer: null,
      model: null,
      deviceName: null,
      isVirtual: null,
      webViewVersion: null,
      userAgent: null,
      clientTimezone: null,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("network");
    expect(logger.warn).toHaveBeenCalled();
  });
});
