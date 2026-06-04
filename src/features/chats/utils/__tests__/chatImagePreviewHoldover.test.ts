import { afterEach, describe, expect, it } from "vitest";
import {
  clearAllImagePreviewHoldoversForTests,
  clearImagePreviewHoldover,
  getImagePreviewHoldover,
  registerImagePreviewHoldover,
} from "../chatImagePreviewHoldover";

afterEach(() => {
  clearAllImagePreviewHoldoversForTests();
});

describe("chatImagePreviewHoldover", () => {
  it("registers and returns preview URLs by idempotency key", () => {
    registerImagePreviewHoldover("key-1", ["blob:a", "blob:b"]);
    expect(getImagePreviewHoldover("key-1")).toEqual(["blob:a", "blob:b"]);
  });

  it("clears holdover entries", () => {
    registerImagePreviewHoldover("key-1", ["blob:a"]);
    clearImagePreviewHoldover("key-1");
    expect(getImagePreviewHoldover("key-1")).toBeNull();
  });
});
