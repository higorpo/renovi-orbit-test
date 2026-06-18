// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  ProviderJobsPage,
  ProviderJobsPersistentSlot,
  ProviderJobsRouteSlot,
  fetchProviderJobs,
  dismissProviderOpportunity,
  useProviderJobs,
  useDismissOpportunity,
  FEED_DEFAULT_LIMIT,
} from "../index";

describe("provider-jobs public API", () => {
  it("exports list and routing components", () => {
    expect(ProviderJobsPage).toBeTypeOf("function");
    expect(ProviderJobsPersistentSlot).toBeTypeOf("function");
    expect(ProviderJobsRouteSlot).toBeTypeOf("function");
  });

  it("exports progressive feed API and hooks", () => {
    expect(fetchProviderJobs).toBeTypeOf("function");
    expect(dismissProviderOpportunity).toBeTypeOf("function");
    expect(useProviderJobs).toBeTypeOf("function");
    expect(useDismissOpportunity).toBeTypeOf("function");
    expect(FEED_DEFAULT_LIMIT).toBe(20);
  });
});
