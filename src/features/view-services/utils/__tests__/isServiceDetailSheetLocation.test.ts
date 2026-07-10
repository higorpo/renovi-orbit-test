import { describe, expect, it } from "vitest";
import type { Location } from "react-router";
import { isServiceDetailSheetLocation } from "../isServiceDetailSheetLocation";

function location(
  pathname: string,
  state: unknown,
): Location {
  return {
    pathname,
    search: "",
    hash: "",
    state,
    key: "default",
  };
}

describe("isServiceDetailSheetLocation", () => {
  it("returns true for sheet presentation with background on service detail path", () => {
    expect(
      isServiceDetailSheetLocation(
        location("/dashboard/services/sr-1", {
          serviceDetailPresentation: "sheet",
          background: { pathname: "/dashboard/services" },
        }),
      ),
    ).toBe(true);
  });

  it("returns false when path is not a service detail route", () => {
    expect(
      isServiceDetailSheetLocation(
        location("/dashboard/services", {
          serviceDetailPresentation: "sheet",
          background: { pathname: "/dashboard/services" },
        }),
      ),
    ).toBe(false);
  });

  it("returns false when presentation is not sheet", () => {
    expect(
      isServiceDetailSheetLocation(
        location("/dashboard/services/sr-1", {
          serviceDetailPresentation: "page",
          background: { pathname: "/dashboard/services" },
        }),
      ),
    ).toBe(false);
  });

  it("returns false when background is missing", () => {
    expect(
      isServiceDetailSheetLocation(
        location("/dashboard/services/sr-1", {
          serviceDetailPresentation: "sheet",
          background: null,
        }),
      ),
    ).toBe(false);
  });
});
