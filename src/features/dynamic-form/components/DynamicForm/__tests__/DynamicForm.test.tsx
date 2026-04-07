import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { DynamicForm } from "../DynamicForm";
import {
  minimalSchema,
  multiStepSchema,
  allBlocksSchema,
  visibilitySchema,
  validationHeavySchema,
  multiStepFilledData,
  allBlocksPartialData,
} from "./fixtures/schemas";

vi.mock("../../../utils/schemaValidator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../utils/schemaValidator")>();
  return {
    ...actual,
    validateFormSchema: vi.fn(),
  };
});

const { validateFormSchema } = await import("../../../utils/schemaValidator");

function mockSchemaValid() {
  vi.mocked(validateFormSchema).mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  });
}

describe("DynamicForm", () => {
  beforeEach(() => {
    mockSchemaValid();
  });

  describe("schema validation", () => {
    it("renders SchemaError when schema validation fails", () => {
      vi.mocked(validateFormSchema).mockReturnValue({
        valid: false,
        errors: [{ code: "NO_STEPS", message: "No steps", severity: "error" }],
        warnings: [],
      });
      render(<DynamicForm schema={minimalSchema} onComplete={vi.fn()} />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Schema inválido")).toBeInTheDocument();
    });

    it("calls validateFormSchema with schema on mount", () => {
      render(<DynamicForm schema={minimalSchema} onComplete={vi.fn()} />);
      expect(validateFormSchema).toHaveBeenCalledWith(minimalSchema);
    });
  });

  describe("config", () => {
    it("shows progress bar when config.showProgressBar is true", () => {
      render(<DynamicForm schema={minimalSchema} onComplete={vi.fn()} />);
      expect(screen.getByText(/Etapa\s+1\s+de\s+1/)).toBeInTheDocument();
    });

    it("hides progress bar when config.showProgressBar is false", () => {
      const schema = {
        ...minimalSchema,
        config: { showProgressBar: false },
      };
      render(<DynamicForm schema={schema} onComplete={vi.fn()} />);
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it("uses initialData to pre-fill form", () => {
      render(
        <DynamicForm
          schema={multiStepSchema}
          onComplete={vi.fn()}
          initialData={{ prop: "apt", urgency: "high" }}
        />
      );
      const casaButton = screen.getByRole("radio", { name: /Casa/i });
      const aptoButton = screen.getByRole("radio", { name: /Apto/i });
      expect(aptoButton).toHaveAttribute("aria-checked", "true");
      expect(casaButton).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("navigation between steps", () => {
    it("shows Cancelar on first step and Voltar on later steps", () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();

      // Fill step 1 and go next
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

      expect(screen.getByRole("button", { name: /Voltar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();
    });

    it("shows Concluir on last step when all steps are filled", async () => {
      render(
        <DynamicForm
          schema={multiStepSchema}
          onComplete={vi.fn()}
          initialData={multiStepFilledData}
        />
      );
      // Go to last step (already filled via initialData)
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Concluir/i })).toBeInTheDocument();
      });
    });

    it("navigates back and step title updates", async () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Second/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /First/i })).toBeInTheDocument();
      });
    });

    it("disables Próximo when current step has required fields empty", () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      const nextBtn = screen.getByRole("button", { name: /Próximo/i });
      expect(nextBtn).toBeDisabled();
    });

    it("enables Próximo when current step required fields are filled", () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      expect(screen.getByRole("button", { name: /Próximo/i })).not.toBeDisabled();
    });

    it("disables Concluir until all steps are valid", async () => {
      // initialData leaves step 3 required field "confirm" empty so Concluir stays disabled
      render(
        <DynamicForm
          schema={multiStepSchema}
          onComplete={vi.fn()}
          initialData={{ prop: "house", urgency: "low", name: "A", desc: "", count: 5 }}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Second/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Third/i }));
      const concluir = screen.getByRole("button", { name: /Concluir/i });
      expect(concluir).toBeDisabled();
    });
  });

  describe("callbacks", () => {
    it("calls onCancel when Cancelar is clicked", () => {
      const onCancel = vi.fn();
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onStepChange when navigating next/back", async () => {
      const onStepChange = vi.fn();
      render(
        <DynamicForm
          schema={multiStepSchema}
          onComplete={vi.fn()}
          onStepChange={onStepChange}
        />
      );
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(onStepChange).toHaveBeenCalledWith(1, "next");
      });

      fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
      await waitFor(() => {
        expect(onStepChange).toHaveBeenCalledWith(0, "back");
      });
    });

    it("calls onComplete with final formData when Concluir is clicked", async () => {
      const onComplete = vi.fn();
      render(
        <DynamicForm
          schema={multiStepSchema}
          onComplete={onComplete}
          initialData={multiStepFilledData}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Second/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Third/i }));
      fireEvent.click(screen.getByRole("button", { name: /Concluir/i }));
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            prop: "house",
            urgency: "low",
            name: "Test User",
            count: 5,
            confirm: true,
          })
        );
      });
    });
  });

  describe("block types rendering and interaction", () => {
    it("renders and fills property_type block", () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      expect(screen.getByText("Tipo")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: /Apto/i }));
      expect(screen.getByRole("radio", { name: /Apto/i })).toHaveAttribute("aria-checked", "true");
    });

    it("renders and fills urgency block", () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /High/i }));
      expect(screen.getByRole("radio", { name: /High/i })).toHaveAttribute("aria-checked", "true");
    });

    it("renders and fills text block", async () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Second/i }));
      const input = screen.getByRole("textbox", { name: /Nome/i });
      fireEvent.change(input, { target: { value: "Maria" } });
      fireEvent.blur(input);
      expect(input).toHaveValue("Maria");
    });

    it("renders and fills textarea block", async () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Second/i }));
      const textarea = screen.getByRole("textbox", { name: /Descrição/i });
      fireEvent.change(textarea, { target: { value: "Long description" } });
      expect(textarea).toHaveValue("Long description");
    });

    it("renders and fills number block with increment/decrement", async () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /Nome/i })).toBeInTheDocument();
      });
      fireEvent.change(screen.getByRole("textbox", { name: /Nome/i }), { target: { value: "X" } });
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByRole("spinbutton", { name: /Quantidade/i })).toBeInTheDocument();
      });

      const increment = screen.getByRole("button", { name: /Aumentar valor/i });
      const input = screen.getByRole("spinbutton", { name: /Quantidade/i });
      fireEvent.click(increment);
      fireEvent.click(increment);
      // Controlled inputs: updates can lag one tick under load (coverage/parallel).
      await waitFor(() => {
        expect(input).toHaveValue(2);
      });
    });

    it("renders and selects yes_no block", async () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /Nome/i })).toBeInTheDocument();
      });
      fireEvent.change(screen.getByRole("textbox", { name: /Nome/i }), { target: { value: "X" } });
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByText(/Confirmar/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("radio", { name: /^Sim$/i }));
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /^Sim$/i })).toHaveAttribute("aria-checked", "true");
      });
    });

    it("renders all block types in allBlocksSchema", () => {
      render(
        <DynamicForm
          schema={allBlocksSchema}
          onComplete={vi.fn()}
          initialData={allBlocksPartialData}
        />
      );
      expect(screen.getByText("Tipo de imóvel")).toBeInTheDocument();
      expect(screen.getByText("Urgência")).toBeInTheDocument();
      expect(screen.getByText("Single")).toBeInTheDocument();
      expect(screen.getByText("Radio")).toBeInTheDocument();
      expect(screen.getByText("Checkbox")).toBeInTheDocument();
      expect(screen.getByText("Sim/Não")).toBeInTheDocument();
      expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByRole("textbox", { name: /Área de texto/i })).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: /Número/i })).toBeInTheDocument();
      expect(screen.getByText(/Slider/i)).toBeInTheDocument();
      expect(screen.getByText(/Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Hora/i)).toBeInTheDocument();
    });

    it("renders static_text block (informational)", () => {
      render(
        <DynamicForm
          schema={allBlocksSchema}
          onComplete={vi.fn()}
          initialData={allBlocksPartialData}
        />
      );
      expect(screen.getByText(/Texto estático \(informativo\)/i)).toBeInTheDocument();
    });

    it("renders conditional_alert when visibility rule is satisfied", () => {
      render(
        <DynamicForm
          schema={allBlocksSchema}
          onComplete={vi.fn()}
          initialData={{ ...allBlocksPartialData, yes_no: true }}
        />
      );
      expect(screen.getByText(/Alerta quando Sim\/Não = Sim/i)).toBeInTheDocument();
    });

    it("exercises multi_select exclusive, allowOther, checkbox exclusive, slider, and description_ai", async () => {
      vi.useFakeTimers();
      try {
        render(
          <DynamicForm
            schema={allBlocksSchema}
            onComplete={vi.fn()}
            initialData={{
              ...allBlocksPartialData,
              multi_select: ["a"],
            }}
          />
        );
        const multiExclusiveBtn = screen.getByText("(seleção exclusiva)").closest("button");
        expect(multiExclusiveBtn).toBeTruthy();
        fireEvent.click(multiExclusiveBtn!);
        act(() => {
          vi.runAllTimers();
        });
        fireEvent.click(screen.getByText("Outro item"));
        fireEvent.change(screen.getByLabelText(/Descreva a opção outro/i), {
          target: { value: "custom note" },
        });
        const checkboxExclusiveLabel = screen.getByText("(exclusivo)").closest("label");
        expect(checkboxExclusiveLabel).toBeTruthy();
        fireEvent.click(checkboxExclusiveLabel!);
        act(() => {
          vi.runAllTimers();
        });
        const sliderInput = screen.getByLabelText(/Slider/i);
        fireEvent.change(sliderInput, { target: { value: "25" } });
        const desc = screen.getByRole("textbox", { name: /Descrição IA/i });
        fireEvent.change(desc, { target: { value: "Short" } });
        expect(desc).toHaveValue("Short");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("validation", () => {
    it("shows validation error when required text is empty and touched", async () => {
      render(<DynamicForm schema={minimalSchema} onComplete={vi.fn()} />);
      const input = screen.getByRole("textbox", { name: /Name/i });
      fireEvent.focus(input);
      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("shows min length error when text is too short", async () => {
      render(<DynamicForm schema={validationHeavySchema} onComplete={vi.fn()} />);
      const input = screen.getByRole("textbox", { name: /Mín 3 caracteres/i });
      fireEvent.change(input, { target: { value: "ab" } });
      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByText(/Mínimo de 3 caracteres/i)).toBeInTheDocument();
      });
    });

    it("shows pattern error when value does not match", async () => {
      render(<DynamicForm schema={validationHeavySchema} onComplete={vi.fn()} />);
      const input = screen.getByRole("textbox", { name: /Só números/i });
      fireEvent.change(input, { target: { value: "abc" } });
      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByText(/Apenas dígitos/i)).toBeInTheDocument();
      });
    });

    it("shows number range error when below min", async () => {
      render(<DynamicForm schema={validationHeavySchema} onComplete={vi.fn()} />);
      const input = screen.getByRole("spinbutton", { name: /Entre 5 e 15/i });
      fireEvent.change(input, { target: { value: "2" } });
      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByText(/Valor mínimo: 5/i)).toBeInTheDocument();
      });
    });

    it("enables next only when step validation passes", async () => {
      render(<DynamicForm schema={validationHeavySchema} onComplete={vi.fn()} />);
      const submitBtn = screen.getByRole("button", { name: /Concluir/i });
      expect(submitBtn).toBeDisabled();

      const requiredInput = screen.getByRole("textbox", { name: /Obrigatório obrigatório/i });
      const minLengthInput = screen.getByRole("textbox", { name: /Mín 3 caracteres/i });
      const patternInput = screen.getByRole("textbox", { name: /Só números/i });
      const numInput = screen.getByRole("spinbutton", { name: /Entre 5 e 15/i });

      fireEvent.change(requiredInput, { target: { value: "x" } });
      fireEvent.change(minLengthInput, { target: { value: "abc" } });
      fireEvent.change(patternInput, { target: { value: "123" } });
      fireEvent.change(numInput, { target: { value: "10" } });
      fireEvent.blur(numInput);

      await waitFor(() => {
        expect(submitBtn).not.toBeDisabled();
      });
    });
  });

  describe("visibility rules", () => {
    it("hides second step when choice is Não", () => {
      render(<DynamicForm schema={visibilitySchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Não/i }));
      expect(screen.getByRole("button", { name: /Concluir/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Second/i })).not.toBeInTheDocument();
    });

    it("shows second step when choice is Sim", async () => {
      render(<DynamicForm schema={visibilitySchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Sim/i }));
      expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Second \(visible when choice=Sim\)/i })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: /Detalhe/i })).toBeInTheDocument();
      });
    });

    it("shows conditional alert in second step when detail is filled", async () => {
      render(<DynamicForm schema={visibilitySchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Sim/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => screen.getByRole("textbox", { name: /Detalhe/i }));
      fireEvent.change(screen.getByRole("textbox", { name: /Detalhe/i }), { target: { value: "x" } });
      await waitFor(() => {
        expect(screen.getByText(/Preenchido/i)).toBeInTheDocument();
      });
    });
  });

  describe("progress bar", () => {
    it("shows current step and total in progress", () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      expect(screen.getByText(/Etapa\s+1\s+de\s+3/)).toBeInTheDocument();
    });

    it("updates progress when moving to next step", async () => {
      render(<DynamicForm schema={multiStepSchema} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      fireEvent.click(screen.getByRole("radio", { name: /Low/i }));
      fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
      await waitFor(() => {
        expect(screen.getByText(/Etapa\s+2\s+de\s+3/)).toBeInTheDocument();
      });
    });
  });

  describe("onChange callback", () => {
    it("calls onChange when a field value changes", async () => {
      const onChange = vi.fn();
      render(
        <DynamicForm
          schema={multiStepSchema}
          onComplete={vi.fn()}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByRole("radio", { name: /Casa/i }));
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        expect(onChange.mock.calls[0][0]).toMatchObject({ prop: "house" });
      });
    });
  });

  describe("className prop", () => {
    it("applies custom className to wrapper", () => {
      const { container } = render(
        <DynamicForm
          schema={minimalSchema}
          onComplete={vi.fn()}
          className="custom-class"
        />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("custom-class");
    });
  });
});
