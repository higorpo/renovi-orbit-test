import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ClientSignupIdentityData, InlineClientSignupFieldsProps } from "@/features/auth";
import { Step5Identity } from "../Step5Identity";
import { mockStep5DataValid } from "./fixtures/requestQuoteTestFixtures";

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth")>();
  return {
    ...actual,
    InlineClientSignupFields: vi.fn((props: InlineClientSignupFieldsProps) => (
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

  it("calls onDataChange with updater function when wrapped component passes function", async () => {
    const onDataChange = vi.fn();
    const authModule = await import("@/features/auth");
    const mockInline = vi.mocked(authModule.InlineClientSignupFields);
    const previousImpl = mockInline.getMockImplementation();
    mockInline.mockImplementation((props: InlineClientSignupFieldsProps) => (
        <div data-testid="inline-client-signup-fields">
          <button
            type="button"
            onClick={() =>
              props.onDataChange((prev: ClientSignupIdentityData) => ({
                ...prev,
                lastName: "UpdatedLastName",
              }))
            }
          >
            Change with updater
          </button>
        </div>
      )
    );
    render(<Step5Identity data={mockStep5DataValid} onDataChange={onDataChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Change with updater" }));
    expect(onDataChange).toHaveBeenCalledTimes(1);
    const arg = onDataChange.mock.calls[0]?.[0];
    expect(typeof arg).toBe("function");
    const result = arg(mockStep5DataValid);
    expect(result).toMatchObject({ ...mockStep5DataValid, lastName: "UpdatedLastName" });
    mockInline.mockImplementation(previousImpl ?? (() => <div />));
  });
});
