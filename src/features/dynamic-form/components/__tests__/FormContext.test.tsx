import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { FormSchema } from "../../types";
import { FormProvider, useFormContext } from "../FormContext";

const schemaTwoSteps: FormSchema = {
  version: "2.0",
  id: "ctx",
  title: "Ctx",
  metadata: { categorySlug: "c", categoryId: null, status: "draft" },
  config: {},
  steps: [
    {
      id: "s1",
      order: 0,
      title: "One",
      blocks: [
        { id: "a", type: "text", label: "A", required: false, description_ai: "A" },
      ],
    },
    {
      id: "s2",
      order: 1,
      title: "Two",
      blocks: [
        { id: "b", type: "text", label: "B", required: false, description_ai: "B" },
      ],
    },
  ],
};

function ConsumerProbe() {
  const v = useFormContext();
  return (
    <div>
      <span data-testid="idx">{v.currentStepIndex}</span>
      <span data-testid="total">{v.totalSteps}</span>
      <button type="button" onClick={() => v.nextStep()}>
        next
      </button>
      <button type="button" onClick={() => v.prevStep()}>
        prev
      </button>
      <button type="button" onClick={() => v.goToStep(5)}>
        goInvalid
      </button>
      <button type="button" onClick={() => v.goToStep(-1)}>
        goNeg
      </button>
      <button type="button" onClick={() => v.goToStep(1)}>
        goSecond
      </button>
      <button type="button" onClick={() => v.setFieldValue("a", "x")}>
        setA
      </button>
    </div>
  );
}

describe("FormContext", () => {
  it("throws when useFormContext is used outside FormProvider", () => {
    const Bad = () => {
      useFormContext();
      return null;
    };
    expect(() => render(<Bad />)).toThrow(/FormProvider/);
  });

  it("navigates next and prev within bounds", () => {
    render(
      <FormProvider schema={schemaTwoSteps}>
        <ConsumerProbe />
      </FormProvider>
    );
    expect(screen.getByTestId("idx")).toHaveTextContent("0");
    act(() => {
      screen.getByRole("button", { name: "next" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("1");
    act(() => {
      screen.getByRole("button", { name: "next" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("1");
    act(() => {
      screen.getByRole("button", { name: "prev" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("0");
    act(() => {
      screen.getByRole("button", { name: "prev" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("0");
  });

  it("ignores goToStep out of range", () => {
    render(
      <FormProvider schema={schemaTwoSteps}>
        <ConsumerProbe />
      </FormProvider>
    );
    act(() => {
      screen.getByRole("button", { name: "goInvalid" }).click();
      screen.getByRole("button", { name: "goNeg" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("0");
    act(() => {
      screen.getByRole("button", { name: "goSecond" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("1");
  });

  it("calls onChange when setFieldValue updates data", () => {
    const onChange = vi.fn();
    render(
      <FormProvider schema={schemaTwoSteps} onChange={onChange}>
        <ConsumerProbe />
      </FormProvider>
    );
    act(() => {
      screen.getByRole("button", { name: "setA" }).click();
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ a: "x" }),
      0
    );
  });

  it("clamps currentStepIndex when visible steps shrink", () => {
    const visSchema: FormSchema = {
      version: "2.0",
      id: "v",
      title: "V",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "First",
          blocks: [
            {
              id: "toggle",
              type: "yes_no",
              label: "Show second?",
              required: true,
              description_ai: "Toggle",
            },
          ],
        },
        {
          id: "s2",
          order: 1,
          title: "Second",
          visibility: [{ dependsOn: "toggle", operator: "equals", value: true }],
          blocks: [
            { id: "x", type: "text", label: "X", required: false, description_ai: "X" },
          ],
        },
      ],
    };

    function Driver() {
      const v = useFormContext();
      return (
        <div>
          <span data-testid="idx">{v.currentStepIndex}</span>
          <button type="button" onClick={() => v.setFieldValue("toggle", true)}>
            show
          </button>
          <button type="button" onClick={() => v.nextStep()}>
            next
          </button>
          <button type="button" onClick={() => v.setFieldValue("toggle", false)}>
            hide
          </button>
        </div>
      );
    }

    render(
      <FormProvider schema={visSchema}>
        <Driver />
      </FormProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "show" }).click();
    });
    act(() => {
      screen.getByRole("button", { name: "next" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("1");

    act(() => {
      screen.getByRole("button", { name: "hide" }).click();
    });
    expect(screen.getByTestId("idx")).toHaveTextContent("0");
  });
});
