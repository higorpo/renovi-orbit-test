import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionCardSkeleton } from "../QuestionCardSkeleton";

describe("QuestionCardSkeleton", () => {
  it("renders card skeleton structure", () => {
    const { container } = render(<QuestionCardSkeleton />);
    expect(container.querySelector('[class*="rounded-lg"]')).toBeTruthy();
  });
});
