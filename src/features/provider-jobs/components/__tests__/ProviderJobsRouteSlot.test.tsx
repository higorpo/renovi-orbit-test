import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProviderJobsRouteSlot } from "../ProviderJobsRouteSlot";

describe("ProviderJobsRouteSlot", () => {
  it("renders nothing so the router can match /dashboard/jobs", () => {
    const { container } = render(<ProviderJobsRouteSlot />);
    expect(container).toBeEmptyDOMElement();
  });
});
