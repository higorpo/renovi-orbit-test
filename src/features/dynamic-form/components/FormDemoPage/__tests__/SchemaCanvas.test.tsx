import type { ComponentProps } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import type { FormSchema } from "../../../types";
import { SchemaCanvas } from "../SchemaCanvas";

const schema: FormSchema = {
  version: "2.0",
  id: "sch",
  title: "Form title",
  metadata: { categorySlug: "c", categoryId: null, status: "draft" },
  config: {},
  steps: [
    {
      id: "step-1",
      order: 0,
      title: "",
      icon: "🔧",
      blocks: [
        { id: "b1", type: "text", label: "Block one", description_ai: "d" },
      ],
    },
    {
      id: "step-2",
      order: 1,
      title: "Second",
      blocks: [],
    },
  ],
};

function renderCanvas(props: Partial<ComponentProps<typeof SchemaCanvas>> = {}) {
  const onSelectSchema = vi.fn();
  const onSelectStep = vi.fn();
  const onSelectBlock = vi.fn();
  const onRemoveStep = vi.fn();
  const onRemoveBlock = vi.fn();
  const onDropBlockType = vi.fn();
  const onMoveBlock = vi.fn();

  render(
    <DndContext onDragEnd={() => {}}>
      <SchemaCanvas
        schema={schema}
        schemaSelected={props.schemaSelected ?? false}
        onSelectSchema={onSelectSchema}
        steps={schema.steps}
        selectedStepId={props.selectedStepId ?? null}
        selectedBlockId={props.selectedBlockId ?? null}
        onSelectStep={onSelectStep}
        onSelectBlock={onSelectBlock}
        onRemoveStep={onRemoveStep}
        onRemoveBlock={onRemoveBlock}
        onDropBlockType={onDropBlockType}
        onMoveBlock={onMoveBlock}
        activeId={props.activeId ?? null}
        isOverStepId={props.isOverStepId ?? null}
        {...props}
      />
    </DndContext>
  );

  return {
    onSelectSchema,
    onSelectStep,
    onSelectBlock,
    onRemoveStep,
    onRemoveBlock,
    onDropBlockType,
    onMoveBlock,
  };
}

describe("SchemaCanvas", () => {
  it("calls onSelectSchema when configuration card is clicked", () => {
    const { onSelectSchema } = renderCanvas();
    fireEvent.click(screen.getByText("Configuração do formulário"));
    expect(onSelectSchema).toHaveBeenCalled();
  });

  it("shows schema id when title is empty on configuration card", () => {
    const emptyTitle: FormSchema = { ...schema, title: "" };
    render(
      <DndContext onDragEnd={() => {}}>
        <SchemaCanvas
          schema={emptyTitle}
          schemaSelected={false}
          onSelectSchema={vi.fn()}
          steps={emptyTitle.steps}
          selectedStepId={null}
          selectedBlockId={null}
          onSelectStep={vi.fn()}
          onSelectBlock={vi.fn()}
          onRemoveStep={vi.fn()}
          onRemoveBlock={vi.fn()}
          onDropBlockType={vi.fn()}
          onMoveBlock={vi.fn()}
          activeId={null}
          isOverStepId={null}
        />
      </DndContext>
    );
    expect(screen.getByText("sch")).toBeInTheDocument();
  });

  it("uses fallback step title and shows block count", () => {
    renderCanvas({ selectedStepId: "step-1", selectedBlockId: "b1" });
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("1 bloco(s)")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("selects step and block and removes block", () => {
    const { onSelectStep, onSelectBlock, onRemoveBlock } = renderCanvas();
    fireEvent.click(screen.getByText("Second"));
    expect(onSelectStep).toHaveBeenCalledWith("step-2");

    fireEvent.click(screen.getByText("Block one"));
    expect(onSelectBlock).toHaveBeenCalledWith("step-1", "b1");

    const removeBlockBtn = screen.getByRole("button", { name: "Remover bloco" });
    fireEvent.click(removeBlockBtn);
    expect(onRemoveBlock).toHaveBeenCalledWith("step-1", "b1");
  });

  it("removes step from trash button", () => {
    const { onRemoveStep } = renderCanvas();
    const removeStepButtons = screen.getAllByRole("button", { name: "Remover step" });
    fireEvent.click(removeStepButtons[0]);
    expect(onRemoveStep).toHaveBeenCalledWith("step-1");
  });

  it("applies isOver highlight class path via isOverStepId", () => {
    const { container } = render(
      <DndContext onDragEnd={() => {}}>
        <SchemaCanvas
          schema={schema}
          schemaSelected={false}
          onSelectSchema={vi.fn()}
          steps={schema.steps}
          selectedStepId={null}
          selectedBlockId={null}
          onSelectStep={vi.fn()}
          onSelectBlock={vi.fn()}
          onRemoveStep={vi.fn()}
          onRemoveBlock={vi.fn()}
          onDropBlockType={vi.fn()}
          onMoveBlock={vi.fn()}
          activeId={null}
          isOverStepId="step-1"
        />
      </DndContext>
    );
    expect(container.querySelector(".ring-primary\\/30")).toBeTruthy();
  });
});
