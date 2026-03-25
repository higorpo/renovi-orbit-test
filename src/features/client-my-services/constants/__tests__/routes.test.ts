import { describe, it, expect } from "vitest";
import {
  ROUTE_SERVICE_REQUESTS_LIST,
  SERVICE_REQUEST_FOCUS_QUERY,
  getServiceDetailPath,
  getServiceRequestsPageUrlWithFocus,
} from "../routes";

describe("routes", () => {
  it("getServiceDetailPath appends id to detail base", () => {
    expect(getServiceDetailPath("abc-123")).toBe("/dashboard/services/abc-123");
  });

  it("getServiceRequestsPageUrlWithFocus builds list URL with query param", () => {
    const url = getServiceRequestsPageUrlWithFocus("sr-99");
    expect(url.startsWith(`${ROUTE_SERVICE_REQUESTS_LIST}?`)).toBe(true);
    expect(url).toContain(`${SERVICE_REQUEST_FOCUS_QUERY}=sr-99`);
  });
});
