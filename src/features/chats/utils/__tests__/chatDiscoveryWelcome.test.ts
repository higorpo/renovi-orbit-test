import { describe, expect, it } from "vitest";
import { getChatDiscoveryWelcomeContent } from "../chatDiscoveryWelcome";

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
