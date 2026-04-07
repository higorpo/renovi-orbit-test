import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { FormDemoPage } from "../FormDemoPage";
import { BlockPalette } from "../BlockPalette";

let dynamicFormAutoCompleteCount = 0;

vi.mock("../../DynamicForm/DynamicForm", () => ({
  DynamicForm: ({
    onComplete,
  }: {
    onComplete: (data: Record<string, unknown>) => void;
  }) => {
    React.useEffect(() => {
      dynamicFormAutoCompleteCount += 1;
      // After "Novo teste", preview remounts; do not submit again or the page stays on success.
      if (dynamicFormAutoCompleteCount === 1) {
        onComplete({ demo: true });
      }
    }, [onComplete]);
    return <div data-testid="dynamic-form-mock">Preview mock</div>;
  },
}));

describe("FormDemoPage", { timeout: 20_000 }, () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    dynamicFormAutoCompleteCount = 0;
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders builder header and palette in Montar schema tab", () => {
    render(<FormDemoPage />);
    expect(screen.getByText(/Motor de formulário dinâmico/)).toBeInTheDocument();
    expect(screen.getByText(/Blocos disponíveis/)).toBeInTheDocument();
  });

  it("copies schema JSON and shows Copiado feedback", async () => {
    render(<FormDemoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar schema JSON/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Copiado/)).toBeInTheDocument();
  });

  it("adds a new step when Novo step is clicked", async () => {
    render(<FormDemoPage />);
    const removeButtons = () =>
      screen.getAllByRole("button", { name: "Remover step" });
    const initial = removeButtons().length;
    fireEvent.click(screen.getByRole("button", { name: /Novo step/i }));
    await waitFor(() => {
      expect(removeButtons().length).toBe(initial + 1);
    });
  });

  it("opens schema inspector when configuration card is clicked", () => {
    render(<FormDemoPage />);
    fireEvent.click(screen.getAllByText("Configuração do formulário")[0]);
    expect(screen.getByText("ID do schema")).toBeInTheDocument();
  });

  it("completes preview via DynamicForm onComplete and resets with Novo teste", async () => {
    render(<FormDemoPage initialTab="preview" />);
    await waitFor(() => {
      expect(screen.getByText(/Formulário enviado/)).toBeInTheDocument();
    });
    expect(screen.getByText(/"demo"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Novo teste/i }));
    await waitFor(() => {
      expect(screen.getByText(/Motor de formulário dinâmico/)).toBeInTheDocument();
    });
  });
});

describe("BlockPalette inside DndContext", () => {
  it("lists draggable block types", () => {
    render(
      <DndContext onDragEnd={() => {}}>
        <BlockPalette />
      </DndContext>
    );
    expect(screen.getByText("Texto (input)")).toBeInTheDocument();
    expect(screen.getByText("Galeria de imagens")).toBeInTheDocument();
  });
});
