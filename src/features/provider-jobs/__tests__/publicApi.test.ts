import { describe, expect, it } from "vitest";
import {
  JobDetailPage,
  ProviderJobsPage,
  ProviderJobsShell,
} from "../index";

describe("provider-jobs public API", () => {
  it("exports page shell components", () => {
    expect(ProviderJobsPage).toBeTypeOf("function");
    expect(JobDetailPage).toBeTypeOf("function");
    expect(ProviderJobsShell).toBeTypeOf("function");
  });
});
