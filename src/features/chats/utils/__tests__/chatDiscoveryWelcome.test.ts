import { describe, expect, it } from "vitest";
import {
  getChatDiscoveryWelcomeContent,
  resolveChatDiscoveryWelcomeAnchorIso,
} from "../chatDiscoveryWelcome";

describe("resolveChatDiscoveryWelcomeAnchorIso", () => {
  it("uses the oldest message timestamp when messages exist", () => {
    expect(
      resolveChatDiscoveryWelcomeAnchorIso(
        [{ created_at: "2026-06-01T10:00:00.000Z" }],
        "2026-05-01T10:00:00.000Z",
      ),
    ).toBe("2026-06-01T10:00:00.000Z");
  });

  it("falls back to conversation created_at when there are no messages", () => {
    expect(resolveChatDiscoveryWelcomeAnchorIso([], "2026-05-01T10:00:00.000Z")).toBe(
      "2026-05-01T10:00:00.000Z",
    );
  });

  it("falls back to now when messages and conversation created_at are missing", () => {
    const before = Date.now();
    const iso = resolveChatDiscoveryWelcomeAnchorIso([], null);
    const after = Date.now();
    const parsed = Date.parse(iso);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});

describe("getChatDiscoveryWelcomeContent", () => {
  it("returns provider-oriented copy", () => {
    const content = getChatDiscoveryWelcomeContent("provider");
    expect(content.title).toContain("negociação");
    expect(content.body).toMatch(/proposta/i);
  });

  it("returns client-oriented copy", () => {
    const content = getChatDiscoveryWelcomeContent("client");
    expect(content.title).toMatch(/prestador/i);
    expect(content.body).toMatch(/proposta/i);
  });
});
