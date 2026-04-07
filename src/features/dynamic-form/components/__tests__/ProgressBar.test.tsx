import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FormSchema } from "../../types";
import { FormProvider } from "../FormContext";
import { ProgressBar } from "../ProgressBar";

function baseSchema(steps: FormSchema["steps"]): FormSchema {
  return {
    version: "2.0",
    id: "p",
    title: "P",
    metadata: { categorySlug: "c", categoryId: null, status: "draft" },
    config: {},
    steps,
  };
}

function textStep(id: string, order: number): FormSchema["steps"][number] {
  return {
    id,
    order,
    title: `T ${order}`,
    blocks: [
      {
        id: `${id}_b`,
        type: "text",
        label: "x",
        required: false,
        description_ai: "x",
      },
    ],
  };
}

function wrap(schema: FormSchema, ui: ReactNode, initialData?: Record<string, unknown>) {
  return render(
    <FormProvider schema={schema} initialData={initialData ?? {}}>
      {ui}
    </FormProvider>
  );
}

describe("ProgressBar", () => {
  it("renders minimal variant with step counts", () => {
    const schema = baseSchema([textStep("a", 0), textStep("b", 1)]);
    wrap(schema, <ProgressBar variant="minimal" />);
    expect(screen.getByText(/Etapa/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders bar variant with percentage", () => {
    const schema = baseSchema([textStep("a", 0)]);
    wrap(schema, <ProgressBar variant="bar" />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders bar variant with showLabels and step title", () => {
    const schema = baseSchema([
      {
        id: "s1",
        order: 0,
        title: "Primeiro",
        icon: "⭐",
        blocks: [
          { id: "b1", type: "text", label: "x", required: false, description_ai: "x" },
        ],
      },
    ]);
    wrap(schema, <ProgressBar variant="bar" showLabels />);
    expect(screen.getByText("Primeiro")).toBeInTheDocument();
  });

  it("renders dots when steps count is within max", () => {
    const schema = baseSchema([
      textStep("s0", 0),
      textStep("s1", 1),
    ]);
    wrap(schema, <ProgressBar variant="dots" />);
    expect(screen.getByText(/Etapa 1 de 2/)).toBeInTheDocument();
  });

  it("renders bar fallback when dots variant and many steps", () => {
    const steps = Array.from({ length: 14 }, (_, i) => textStep(`s${i}`, i));
    const schema = baseSchema(steps);
    wrap(schema, <ProgressBar variant="dots" />);
    expect(screen.getByText(/Etapa 1 de 14/)).toBeInTheDocument();
  });

  it("renders steps variant with step title and connector lines", () => {
    const schema = baseSchema([
      {
        id: "s1",
        order: 0,
        title: "Alpha",
        icon: "🔷",
        description: "Desc",
        blocks: [
          { id: "b1", type: "text", label: "x", required: false, description_ai: "x" },
        ],
      },
      textStep("s2", 1),
    ]);
    wrap(schema, <ProgressBar variant="steps" />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("🔷")).toBeInTheDocument();
  });

  it("minimal variant shows counts when no visible steps exist", () => {
    const schema = baseSchema([
      {
        id: "hidden",
        order: 0,
        title: "Hidden",
        visibility: [{ dependsOn: "nope", operator: "equals", value: true }],
        blocks: [
          { id: "b1", type: "text", label: "x", required: false, description_ai: "x" },
        ],
      },
    ]);
    wrap(schema, <ProgressBar variant="minimal" />);
    expect(screen.getByText(/Etapa/)).toBeInTheDocument();
  });

  it("bar variant shows 0% when no visible steps exist", () => {
    const schema = baseSchema([
      {
        id: "hidden",
        order: 0,
        title: "Hidden",
        visibility: [{ dependsOn: "nope", operator: "equals", value: true }],
        blocks: [
          { id: "b1", type: "text", label: "x", required: false, description_ai: "x" },
        ],
      },
    ]);
    wrap(schema, <ProgressBar variant="bar" />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("steps variant omits title section when currentStepData is missing", () => {
    const schema = baseSchema([
      {
        id: "hidden",
        order: 0,
        title: "Hidden",
        visibility: [{ dependsOn: "nope", operator: "equals", value: true }],
        blocks: [
          { id: "b1", type: "text", label: "x", required: false, description_ai: "x" },
        ],
      },
    ]);
    wrap(schema, <ProgressBar variant="steps" />);
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("dots variant highlights current incomplete step", () => {
    const schema = baseSchema([
      {
        id: "s1",
        order: 0,
        title: "One",
        blocks: [
          { id: "b1", type: "text", label: "Required", required: true, description_ai: "x" },
        ],
      },
      textStep("s2", 1),
    ]);
    const { container } = wrap(schema, <ProgressBar variant="dots" />);
    const dots = container.querySelectorAll(".rounded-full");
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });
});
