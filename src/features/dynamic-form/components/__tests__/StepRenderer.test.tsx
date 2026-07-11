import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { FormSchema } from "../../types";
import { FormProvider, useFormContext } from "../FormContext";
import { StepRenderer } from "../StepRenderer";

describe("StepRenderer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading copy when there is no current step", () => {
    const emptyVisible: FormSchema = {
      version: "2.0",
      id: "e",
      title: "E",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "hidden",
          order: 0,
          title: "H",
          visibility: [{ dependsOn: "nope", operator: "equals", value: true }],
          blocks: [
            { id: "b", type: "text", label: "B", required: false, description_ai: "B" },
          ],
        },
      ],
    };
    render(
      <FormProvider schema={emptyVisible}>
        <StepRenderer />
      </FormProvider>
    );
    expect(screen.getByText(/Carregando formulário/)).toBeInTheDocument();
  });

  it("renders unsupported block message for unknown block type", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "u",
      title: "U",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "S",
          blocks: [
            {
              id: "bad",
              type: "not_a_real_type" as unknown as "text",
              label: "Bad",
              description_ai: "Bad block",
            },
          ],
        },
      ],
    };
    render(
      <FormProvider schema={schema}>
        <StepRenderer />
      </FormProvider>
    );
    expect(screen.getByText(/Tipo de bloco não suportado/)).toBeInTheDocument();
    expect(screen.getByText(/ID: bad/)).toBeInTheDocument();
  });

  it("renders step title without icon or description when omitted", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "plain",
      title: "Plain",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "Só título",
          blocks: [
            { id: "t", type: "text", label: "T", required: false, description_ai: "T" },
          ],
        },
      ],
    };
    render(
      <FormProvider schema={schema}>
        <StepRenderer />
      </FormProvider>
    );
    expect(screen.getByRole("heading", { name: "Só título" })).toBeInTheDocument();
    expect(screen.queryByText("🎯")).not.toBeInTheDocument();
  });

  it("renders step icon and description when present", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "ic",
      title: "Ic",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "Titled",
          icon: "🎯",
          description: "Sub copy",
          blocks: [
            { id: "t", type: "text", label: "T", required: false, description_ai: "T" },
          ],
        },
      ],
    };
    render(
      <FormProvider schema={schema}>
        <StepRenderer />
      </FormProvider>
    );
    expect(screen.getByText("🎯")).toBeInTheDocument();
    expect(screen.getByText("Titled")).toBeInTheDocument();
    expect(screen.getByText("Sub copy")).toBeInTheDocument();
  });

  it("does not call onAutoAdvance when autoAdvance block receives an empty value", () => {
    const onAuto = vi.fn();
    const schema: FormSchema = {
      version: "2.0",
      id: "auto-empty",
      title: "Auto",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "S1",
          blocks: [
            {
              id: "t1",
              type: "text",
              label: "Type",
              required: false,
              description_ai: "T",
              config: { autoAdvance: true },
            },
          ],
        },
      ],
    };
    render(
      <FormProvider schema={schema}>
        <StepRenderer onAutoAdvance={onAuto} />
      </FormProvider>
    );
    const input = screen.getByRole("textbox", { name: /Type/i });
    fireEvent.change(input, { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onAuto).not.toHaveBeenCalled();
  });

  it("calls onAutoAdvance after field change when block has autoAdvance", () => {
    const onAuto = vi.fn();
    const schema: FormSchema = {
      version: "2.0",
      id: "auto",
      title: "Auto",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "S1",
          blocks: [
            {
              id: "pick",
              type: "yes_no",
              label: "Pick",
              required: true,
              description_ai: "Pick",
              config: { autoAdvance: true },
            },
          ],
        },
      ],
    };
    render(
      <FormProvider schema={schema}>
        <StepRenderer onAutoAdvance={onAuto} />
      </FormProvider>
    );
    fireEvent.click(screen.getByRole("radio", { name: /Sim/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onAuto).toHaveBeenCalled();
  });

  it("renders related conditional alerts under the source block", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "rel",
      title: "Rel",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "S",
          blocks: [
            {
              id: "gate",
              type: "yes_no",
              label: "Gate",
              required: true,
              description_ai: "Gate",
            },
            {
              id: "al",
              type: "conditional_alert",
              label: "",
              description_ai: "Alert text",
              visibility: [{ dependsOn: "gate", operator: "equals", value: true }],
              config: { alertType: "info", alertTitle: "Heads up" },
            },
          ],
        },
      ],
    };
    render(
      <FormProvider schema={schema}>
        <StepRenderer />
      </FormProvider>
    );
    fireEvent.click(screen.getByRole("radio", { name: /Sim/i }));
    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });

  it("navigates to the step that owns a field when editing from preview summary", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "edit-summary",
      title: "Edit",
      metadata: { categorySlug: "c", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "First step",
          blocks: [
            {
              id: "name",
              type: "text",
              label: "Nome",
              required: true,
              description_ai: "Name",
            },
          ],
        },
        {
          id: "s2",
          order: 1,
          title: "Summary step",
          blocks: [
            {
              id: "preview",
              type: "preview_summary",
              label: "Resumo",
              description_ai: "Summary",
            },
          ],
        },
      ],
    };

    function JumpToSummary() {
      const { goToStep } = useFormContext();
      return (
        <button type="button" onClick={() => goToStep(1)}>
          go-summary
        </button>
      );
    }

    render(
      <FormProvider schema={schema} initialData={{ name: "Ana" }}>
        <JumpToSummary />
        <StepRenderer />
      </FormProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /go-summary/i }));
    expect(screen.getByRole("heading", { name: "Summary step" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nome/i })).toBeInTheDocument();
  });
});
