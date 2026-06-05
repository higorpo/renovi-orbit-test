// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  ProviderJobsPage,
  ProviderJobsPersistentSlot,
  ProviderJobsRouteSlot,
} from "../index";

describe("provider-jobs public API", () => {
  it("exports list and routing components", () => {
    expect(ProviderJobsPage).toBeTypeOf("function");
    expect(ProviderJobsPersistentSlot).toBeTypeOf("function");
    expect(ProviderJobsRouteSlot).toBeTypeOf("function");
  });
});
