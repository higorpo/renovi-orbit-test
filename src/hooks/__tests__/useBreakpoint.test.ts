// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useMediaQueryMock = vi.fn();

vi.mock("../useMediaQuery", () => ({
  useMediaQuery: (query: string) => useMediaQueryMock(query),
}));

import { useBreakpointMd } from "../useBreakpoint";

describe("useBreakpointMd", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
  });

  it("uses the Tailwind md minimum-width query", () => {
    useMediaQueryMock.mockReturnValue(true);

    const { result } = renderHook(() => useBreakpointMd());

    expect(useMediaQueryMock).toHaveBeenCalledWith("(min-width: 768px)");
    expect(result.current).toBe(true);
  });

  it("returns false below the md breakpoint", () => {
    useMediaQueryMock.mockReturnValue(false);

    const { result } = renderHook(() => useBreakpointMd());

    expect(result.current).toBe(false);
  });
});
