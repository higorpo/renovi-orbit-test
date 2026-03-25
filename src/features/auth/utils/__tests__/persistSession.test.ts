import { describe, it, expect } from "vitest";
// This module re-exports from @/lib/persistSession; importing it ensures coverage.
import * as persistSession from "../persistSession";

describe("persistSession re-exports", () => {
  it("exports getPersistSession", () => {
    expect(persistSession.getPersistSession).toBeDefined();
  });

  it("exports setPersistSession", () => {
    expect(persistSession.setPersistSession).toBeDefined();
  });
});
