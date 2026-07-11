import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

type DndHandlers = {
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
};

let capturedHandlers: DndHandlers = {};

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragOver,
      onDragEnd,
    }: React.PropsWithChildren<DndHandlers>) => {
      capturedHandlers = { onDragStart, onDragOver, onDragEnd };
      return <div data-testid="dnd-context">{children}</div>;
    },
    DragOverlay: ({ children }: React.PropsWithChildren) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
  };
});

vi.mock("../../DynamicForm/DynamicForm", () => ({
  DynamicForm: () => <div data-testid="dynamic-form-mock">Preview mock</div>,
}));

import { FormDemoPage } from "../FormDemoPage";

describe("FormDemoPage drag handlers", { timeout: 20_000 }, () => {
  beforeEach(() => {
    capturedHandlers = {};
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a palette block when dropped on a step", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragEnd).toBeTypeOf("function");
    });

    const before = screen.getAllByRole("button", { name: "Remover bloco" }).length;

    capturedHandlers.onDragStart?.({
      active: { id: "palette-text", data: { current: { blockType: "text" } } },
    } as DragStartEvent);

    capturedHandlers.onDragOver?.({
      over: { id: "step-step-1" },
    } as DragOverEvent);

    capturedHandlers.onDragEnd?.({
      active: {
        id: "palette-text",
        data: { current: { blockType: "text" } },
      },
      over: { id: "step-step-1" },
    } as DragEndEvent);

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Remover bloco" }).length,
      ).toBeGreaterThan(before);
    });
  });

  it("clears over highlight when dragOver has no step target", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragOver).toBeTypeOf("function");
    });

    capturedHandlers.onDragOver?.({ over: null } as DragOverEvent);
    capturedHandlers.onDragOver?.({
      over: { id: 42 },
    } as unknown as DragOverEvent);
    capturedHandlers.onDragOver?.({
      over: { id: "block-xyz" },
    } as DragOverEvent);

    capturedHandlers.onDragEnd?.({
      active: { id: "palette-number", data: { current: {} } },
      over: null,
    } as DragEndEvent);

    expect(screen.getByTestId("dnd-context")).toBeInTheDocument();
  });

  it("moves a step block when dropped on another block", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragEnd).toBeTypeOf("function");
    });

    const labelsBefore = screen
      .getAllByRole("button", { name: "Remover bloco" })
      .map((btn) => btn.closest("div")?.textContent ?? "");

    capturedHandlers.onDragEnd?.({
      active: {
        id: "yes_no_required",
        data: {
          current: {
            source: "step-block",
            stepId: "step-1",
            blockId: "yes_no_required",
          },
        },
      },
      over: { id: "yes_no_optional" },
    } as DragEndEvent);

    await waitFor(() => {
      const labelsAfter = screen
        .getAllByRole("button", { name: "Remover bloco" })
        .map((btn) => btn.closest("div")?.textContent ?? "");
      expect(labelsAfter).not.toEqual(labelsBefore);
    });
  });

  it("shows drag overlay label while palette item is active", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragStart).toBeTypeOf("function");
    });

    capturedHandlers.onDragStart?.({
      active: { id: "palette-text", data: { current: { blockType: "text" } } },
    } as DragStartEvent);

    await waitFor(() => {
      expect(screen.getByText("Texto (input)")).toBeInTheDocument();
    });
  });

  it("ignores palette drop when over target is not a step", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragEnd).toBeTypeOf("function");
    });

    const before = screen.getAllByRole("button", { name: "Remover bloco" }).length;
    capturedHandlers.onDragEnd?.({
      active: {
        id: "palette-text",
        data: { current: { blockType: "text" } },
      },
      over: { id: "yes_no_required" },
    } as DragEndEvent);

    expect(
      screen.getAllByRole("button", { name: "Remover bloco" }).length,
    ).toBe(before);
  });

  it("does not move block when drop target index is unchanged", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragEnd).toBeTypeOf("function");
    });

    capturedHandlers.onDragEnd?.({
      active: {
        id: "yes_no_required",
        data: {
          current: {
            source: "step-block",
            stepId: "step-1",
            blockId: "yes_no_required",
          },
        },
      },
      over: { id: "yes_no_required" },
    } as DragEndEvent);

    expect(screen.getByTestId("dnd-context")).toBeInTheDocument();
  });

  it("clears drag overlay when active id is not a palette item", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragStart).toBeTypeOf("function");
    });

    capturedHandlers.onDragStart?.({
      active: { id: "yes_no_required", data: { current: {} } },
    } as DragStartEvent);

    await waitFor(() => {
      expect(screen.getByTestId("drag-overlay").textContent).toBe("");
    });
  });

  it("infers palette block type from active id when data omits blockType", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragEnd).toBeTypeOf("function");
    });

    const before = screen.getAllByRole("button", { name: "Remover bloco" }).length;
    capturedHandlers.onDragEnd?.({
      active: { id: "palette-number", data: { current: {} } },
      over: { id: "step-step-1" },
    } as DragEndEvent);

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Remover bloco" }).length,
      ).toBeGreaterThan(before);
    });
  });

  it("ignores step-block move when step id is unknown", async () => {
    render(<FormDemoPage />);
    await waitFor(() => {
      expect(capturedHandlers.onDragEnd).toBeTypeOf("function");
    });

    const before = screen.getAllByRole("button", { name: "Remover bloco" }).length;
    capturedHandlers.onDragEnd?.({
      active: {
        id: "yes_no_required",
        data: {
          current: {
            source: "step-block",
            stepId: "missing-step",
            blockId: "yes_no_required",
          },
        },
      },
      over: { id: "yes_no_optional" },
    } as DragEndEvent);

    expect(
      screen.getAllByRole("button", { name: "Remover bloco" }).length,
    ).toBe(before);
  });
});
