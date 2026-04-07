import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step2ServiceForm } from "../Step2ServiceForm";
import { mockFormSchema } from "./fixtures/requestQuoteTestFixtures";

vi.mock("@/features/dynamic-form", () => ({
  DynamicForm: ({
    onStepChange,
    onComplete,
    onCancel,
  }: {
    onStepChange: (stepIndex: number, direction: string) => void;
    onComplete: (formData: Record<string, unknown>) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="trigger-step-change"
        onClick={() => onStepChange(1, "next")}
      >
        Step change
      </button>
      <button type="button" data-testid="trigger-complete" onClick={() => onComplete({ f: "v" })}>
        Complete
      </button>
      <button type="button" data-testid="trigger-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
  DynamicFormSkeleton: () => <div className="animate-pulse">skeleton</div>,
}));

vi.mock("../../../hooks/useServiceSchema", () => ({
  useServiceSchema: vi.fn(),
}));

const useServiceSchema = await import("../../../hooks/useServiceSchema").then((m) =>
  vi.mocked(m.useServiceSchema)
);

describe("Step2ServiceForm (DynamicForm callbacks)", () => {
  const defaultProps = {
    serviceSlug: "limpeza",
    serviceId: "svc-1",
    data: {},
    onDataChange: vi.fn(),
    onComplete: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    useServiceSchema.mockReturnValue({
      schema: mockFormSchema,
      fallbackReason: null,
      isLoading: false,
    });
  });

  it("handles onStepChange from DynamicForm without throwing", () => {
    render(<Step2ServiceForm {...defaultProps} />);
    expect(() => fireEvent.click(screen.getByTestId("trigger-step-change"))).not.toThrow();
  });

  it("calls onBack when DynamicForm invokes onCancel", () => {
    const onBack = vi.fn();
    render(<Step2ServiceForm {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByTestId("trigger-cancel"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onDataChange and onComplete when DynamicForm invokes onComplete", () => {
    const onDataChange = vi.fn();
    const onComplete = vi.fn();
    render(
      <Step2ServiceForm {...defaultProps} onDataChange={onDataChange} onComplete={onComplete} />
    );
    fireEvent.click(screen.getByTestId("trigger-complete"));
    expect(onDataChange).toHaveBeenCalledWith({ f: "v" });
    expect(onComplete).toHaveBeenCalledWith({ f: "v" }, mockFormSchema);
  });
});
