import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { FormSchema } from "../../../types";
import { useSchemaBuilder } from "../useSchemaBuilder";
import { formDemoSchema } from "../demoSchema";

const tinySchema: FormSchema = {
  version: "2.0",
  id: "tiny",
  title: "Tiny",
  metadata: { categorySlug: "c", categoryId: null, status: "draft" },
  config: {},
  steps: [
    {
      id: "only",
      order: 0,
      title: "Only",
      blocks: [
        { id: "b1", type: "text", label: "T", required: false, description_ai: "T" },
      ],
    },
  ],
};

describe("useSchemaBuilder", () => {
  it("initializes with provided schema", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    expect(result.current.schema.id).toBe("tiny");
    expect(result.current.schema.steps).toHaveLength(1);
  });

  it("addStep appends a step and selects it", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.addStep();
    });
    expect(result.current.schema.steps.length).toBeGreaterThan(1);
    expect(result.current.selection?.type).toBe("step");
  });

  it("removeStep clears selection when removing selected step", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.setSelection({ type: "step", stepId: "only" });
    });
    act(() => {
      result.current.removeStep("only");
    });
    expect(result.current.schema.steps).toHaveLength(0);
    expect(result.current.selection).toBeNull();
  });

  it("addBlockToStep adds block and selects it", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.addBlockToStep("only", "number");
    });
    const step = result.current.schema.steps.find((s) => s.id === "only");
    expect(step?.blocks.some((b) => b.type === "number")).toBe(true);
    expect(result.current.selection).toEqual(
      expect.objectContaining({ type: "block", stepId: "only" })
    );
  });

  it("removeBlock clears block selection", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    let blockId = "";
    act(() => {
      result.current.addBlockToStep("only", "textarea");
      blockId = result.current.selection?.type === "block" ? result.current.selection.blockId : "";
    });
    act(() => {
      result.current.removeBlock("only", blockId);
    });
    expect(
      result.current.schema.steps.find((s) => s.id === "only")?.blocks.some((b) => b.id === blockId)
    ).toBe(false);
  });

  it("moveBlock reorders blocks within step", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.addBlockToStep("only", "text");
      result.current.addBlockToStep("only", "text");
    });
    const step = result.current.schema.steps.find((s) => s.id === "only")!;
    const [firstId, secondId] = [step.blocks[0]!.id, step.blocks[1]!.id];
    act(() => {
      result.current.moveBlock("only", 0, 1);
    });
    const after = result.current.schema.steps.find((s) => s.id === "only")!;
    expect(after.blocks[0]!.id).toBe(secondId);
    expect(after.blocks[1]!.id).toBe(firstId);
  });

  it("moveBlock no-op when fromIndex equals toIndex", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    const before = result.current.schema.steps.find((s) => s.id === "only")!.blocks.map((b) => b.id);
    act(() => {
      result.current.moveBlock("only", 0, 0);
    });
    const after = result.current.schema.steps.find((s) => s.id === "only")!.blocks.map((b) => b.id);
    expect(after).toEqual(before);
  });

  it("updateSchemaRoot merges metadata and config", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.updateSchemaRoot({
        title: "New title",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: false },
      });
    });
    expect(result.current.schema.title).toBe("New title");
    expect(result.current.schema.metadata.categorySlug).toBe("x");
    expect(result.current.schema.config.showProgressBar).toBe(false);
  });

  it("updateStep and updateBlock mutate targeted entities", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.updateStep("only", { title: "Renamed" });
      result.current.updateBlock("only", "b1", { label: "L2" });
    });
    expect(result.current.schema.steps[0]!.title).toBe("Renamed");
    expect(result.current.schema.steps[0]!.blocks[0]!.label).toBe("L2");
  });

  it("setSchemaFromJson replaces schema and clears selection", () => {
    const { result } = renderHook(() => useSchemaBuilder(formDemoSchema));
    act(() => {
      result.current.setSelection({ type: "schema" });
      result.current.setSchemaFromJson(tinySchema);
    });
    expect(result.current.schema.id).toBe("tiny");
    expect(result.current.selection).toBeNull();
  });

  it("selectedStep and selectedBlock reflect selection", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.setSelection({ type: "block", stepId: "only", blockId: "b1" });
    });
    expect(result.current.selectedStep?.id).toBe("only");
    expect(result.current.selectedBlock?.id).toBe("b1");
  });

  it("updateSchema applies functional updater", () => {
    const { result } = renderHook(() => useSchemaBuilder(tinySchema));
    act(() => {
      result.current.updateSchema((prev) => ({
        ...prev,
        title: "Via updater",
      }));
    });
    expect(result.current.schema.title).toBe("Via updater");
  });
});
