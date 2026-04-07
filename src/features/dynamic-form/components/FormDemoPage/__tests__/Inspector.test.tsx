import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FormBlock, FormSchema, FormStep } from "../../../types";
import { Inspector } from "../Inspector";

const schema: FormSchema = {
  version: "2.0",
  id: "s",
  title: "T",
  metadata: { categorySlug: "c", categoryId: null, status: "draft" },
  config: {},
  steps: [
    {
      id: "step-a",
      order: 0,
      title: "Step A",
      blocks: [{ id: "b1", type: "text", label: "L1", description_ai: "d" }],
    },
  ],
};

const step: FormStep = schema.steps[0];
const block: FormBlock = step.blocks[0];

describe("Inspector", () => {
  it("renders InspectorSchema when selectionType is schema", () => {
    render(
      <Inspector
        schema={schema}
        selectedStep={null}
        selectedBlock={null}
        selectionType="schema"
        stepId={null}
        blockId={null}
        onUpdateSchemaRoot={vi.fn()}
        onUpdateStep={vi.fn()}
        onUpdateBlock={vi.fn()}
      />
    );
    expect(screen.getByText("ID do schema")).toBeInTheDocument();
  });

  it("shows placeholder when nothing is selected", () => {
    render(
      <Inspector
        schema={schema}
        selectedStep={null}
        selectedBlock={null}
        selectionType={null}
        stepId={null}
        blockId={null}
        onUpdateSchemaRoot={vi.fn()}
        onUpdateStep={vi.fn()}
        onUpdateBlock={vi.fn()}
      />
    );
    expect(screen.getByText(/Selecione um step/)).toBeInTheDocument();
  });

  it("renders InspectorStep for step selection", () => {
    render(
      <Inspector
        schema={schema}
        selectedStep={step}
        selectedBlock={null}
        selectionType="step"
        stepId="step-a"
        blockId={null}
        onUpdateSchemaRoot={vi.fn()}
        onUpdateStep={vi.fn()}
        onUpdateBlock={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Step A")).toBeInTheDocument();
  });

  it("renders InspectorBlock for block selection", () => {
    render(
      <Inspector
        schema={schema}
        selectedStep={step}
        selectedBlock={block}
        selectionType="block"
        stepId="step-a"
        blockId="b1"
        onUpdateSchemaRoot={vi.fn()}
        onUpdateStep={vi.fn()}
        onUpdateBlock={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("b1")).toBeInTheDocument();
  });

  it("returns null when block selected but blockId is missing", () => {
    const { container } = render(
      <Inspector
        schema={schema}
        selectedStep={step}
        selectedBlock={block}
        selectionType="block"
        stepId="step-a"
        blockId={null}
        onUpdateSchemaRoot={vi.fn()}
        onUpdateStep={vi.fn()}
        onUpdateBlock={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
