import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Step5Identity } from "../Step5Identity";
import { mockStep5DataValid } from "./fixtures/requestQuoteTestFixtures";

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth")>();
  return {
    ...actual,
    InlineClientSignupFields: vi.fn((props: {
      data: typeof mockStep5DataValid;
      onDataChange: (data: unknown) => void;
      title?: string;
    }) => (
      <div data-testid="inline-client-signup-fields">
        <span data-testid="title">{props.title}</span>
        <button
          type="button"
          onClick={() =>
            props.onDataChange({
              ...props.data,
              firstName: "Updated",
            })
          }
        >
          Change data
        </button>
      </div>
    )),
  };
});

describe("Step5Identity", () => {
  it("renders InlineClientSignupFields with data, onDataChange and title Seus dados", () => {
    const onDataChange = vi.fn();
    render(<Step5Identity data={mockStep5DataValid} onDataChange={onDataChange} />);

    expect(screen.getByTestId("inline-client-signup-fields")).toBeInTheDocument();
    expect(screen.getByTestId("title")).toHaveTextContent("Seus dados");
    expect(screen.getByRole("button", { name: "Change data" })).toBeInTheDocument();
  });

  it("calls onDataChange when wrapped component triggers change", () => {
    const onDataChange = vi.fn();
    render(<Step5Identity data={mockStep5DataValid} onDataChange={onDataChange} />);

    screen.getByRole("button", { name: "Change data" }).click();

    expect(onDataChange).toHaveBeenCalledTimes(1);
    expect(onDataChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockStep5DataValid,
        firstName: "Updated",
      })
    );
  });
});
