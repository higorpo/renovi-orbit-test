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
    onCancel,
  }: {
    onComplete: (data: Record<string, unknown>) => void;
    onCancel?: () => void;
  }) => {
    React.useEffect(() => {
      dynamicFormAutoCompleteCount += 1;
      // After "Novo teste", preview remounts; do not submit again or the page stays on success.
      if (dynamicFormAutoCompleteCount === 1) {
        onComplete({ demo: true });
      }
    }, [onComplete]);
    return (
      <div data-testid="dynamic-form-mock">
        Preview mock
        {onCancel ? (
          <button type="button" onClick={onCancel}>
            Cancel preview
          </button>
        ) : null}
      </div>
    );
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

  it("renders preview tab content when initialTab is preview", async () => {
    // Avoid auto-complete so we stay on the preview form (not success screen).
    dynamicFormAutoCompleteCount = 99;
    render(<FormDemoPage initialTab="preview" />);
    await waitFor(() => {
      expect(screen.getByTestId("dynamic-form-mock")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Preencha o formulário abaixo/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Preview/i })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("selects a block and updates inspector label", async () => {
    render(<FormDemoPage />);
    fireEvent.click(screen.getByText("Você já possui um imóvel?"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Rótulo do campo")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Rótulo do campo"), {
      target: { value: "Novo rótulo" },
    });
    expect(screen.getByDisplayValue("Novo rótulo")).toBeInTheDocument();
  });

  it("selects a step and shows step inspector", async () => {
    render(<FormDemoPage />);
    fireEvent.click(screen.getByText(/Informações iniciais/i));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Título do step")).toBeInTheDocument();
    });
  });
  it("removes a step from the canvas", async () => {
    render(<FormDemoPage />);
    const removeButtons = () =>
      screen.getAllByRole("button", { name: "Remover step" });
    const initial = removeButtons().length;
    fireEvent.click(removeButtons()[0]!);
    await waitFor(() => {
      expect(removeButtons().length).toBe(initial - 1);
    });
  });

  it("removes a block from the canvas", async () => {
    render(<FormDemoPage />);
    const removeBlock = () =>
      screen.getAllByRole("button", { name: "Remover bloco" });
    const initial = removeBlock().length;
    expect(initial).toBeGreaterThan(0);
    fireEvent.click(removeBlock()[0]!);
    await waitFor(() => {
      expect(removeBlock().length).toBe(initial - 1);
    });
  });

  it("calls history.back when preview DynamicForm cancels", async () => {
    dynamicFormAutoCompleteCount = 99;
    render(<FormDemoPage initialTab="preview" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cancel preview/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancel preview/i }));
    expect(window.history.back).toHaveBeenCalled();
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
