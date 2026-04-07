import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockPalette } from "../FormDemoPage/BlockPalette";

vi.mock("@dnd-kit/core", () => ({
  useDraggable: vi.fn(),
}));

import { useDraggable } from "@dnd-kit/core";

function mockDraggingState(isDragging: boolean) {
  vi.mocked(useDraggable).mockReturnValue({
    active: null,
    activatorEvent: null,
    attributes: {},
    isDragging,
    listeners: {},
    node: { current: null },
    over: null,
    setNodeRef: vi.fn(),
    transform: null,
  } as unknown as ReturnType<typeof useDraggable>);
}

describe("BlockPalette", () => {
  beforeEach(() => {
    mockDraggingState(false);
  });

  it("renders heading and block type labels", () => {
    render(<BlockPalette />);
    expect(screen.getByText("Blocos disponíveis")).toBeInTheDocument();
    expect(screen.getByText("Texto (input)")).toBeInTheDocument();
  });

  it("applies opacity when palette item is dragging", () => {
    mockDraggingState(true);
    const { container } = render(<BlockPalette />);
    expect(container.querySelector(".opacity-50")).toBeTruthy();
  });
});
