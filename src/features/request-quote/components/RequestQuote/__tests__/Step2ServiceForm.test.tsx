import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Step2ServiceForm } from "../Step2ServiceForm";
import { mockFormSchema } from "./fixtures/requestQuoteTestFixtures";
import { renderWithRequestQuoteProviders } from "./testUtils";

vi.mock("../../../hooks/useServiceSchema", () => ({
  useServiceSchema: vi.fn(),
}));

const useServiceSchema = await import("../../../hooks/useServiceSchema").then(
  (m) => vi.mocked(m.useServiceSchema)
);

// DynamicForm validates schema on mount; mock to avoid validation errors
vi.mock("@/features/dynamic-form/utils/schemaValidator", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/dynamic-form/utils/schemaValidator")
  >();
  return {
    ...actual,
    validateFormSchema: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  };
});

describe("Step2ServiceForm", () => {
  const defaultProps = {
    serviceSlug: "limpeza",
    serviceId: "svc-1",
    data: {},
    onDataChange: vi.fn(),
    onComplete: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(useServiceSchema).mockReturnValue({
      schema: null,
      fallbackReason: null,
      isLoading: false,
    });
  });

  describe("loading state", () => {
    it("renders DynamicFormSkeleton when isLoading is true", () => {
      useServiceSchema.mockReturnValue({
        schema: null,
        fallbackReason: null,
        isLoading: true,
      });
      const { container } = render(<Step2ServiceForm {...defaultProps} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("Formulário não configurado")).not.toBeInTheDocument();
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("no schema", () => {
    it("renders destructive Alert with title when schema is null", () => {
      useServiceSchema.mockReturnValue({
        schema: null,
        fallbackReason: null,
        isLoading: false,
      });
      render(<Step2ServiceForm {...defaultProps} />);
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(screen.getByText("Formulário não configurado")).toBeInTheDocument();
      expect(
        screen.getByText(/O formulário para este serviço ainda não foi configurado no sistema/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Por favor, entre em contato com o suporte ou tente novamente mais tarde/)
      ).toBeInTheDocument();
    });

    it("shows fallbackReason when provided", () => {
      useServiceSchema.mockReturnValue({
        schema: null,
        fallbackReason: "no_form",
        isLoading: false,
      });
      render(<Step2ServiceForm {...defaultProps} />);
      expect(screen.getByText("Motivo: no_form")).toBeInTheDocument();
    });

    it("does not show Motivo when fallbackReason is null", () => {
      useServiceSchema.mockReturnValue({
        schema: null,
        fallbackReason: null,
        isLoading: false,
      });
      render(<Step2ServiceForm {...defaultProps} />);
      expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument();
    });
  });

  describe("with schema", () => {
    beforeEach(() => {
      useServiceSchema.mockReturnValue({
        schema: mockFormSchema,
        fallbackReason: null,
        isLoading: false,
      });
    });

    it("renders DynamicForm with schema and initialData", () => {
      renderWithRequestQuoteProviders(<Step2ServiceForm {...defaultProps} />);
      expect(screen.getByText("Campo")).toBeInTheDocument();
    });

    it("passes data as initialData to DynamicForm", () => {
      const data = { field1: "prefilled" };
      renderWithRequestQuoteProviders(
        <Step2ServiceForm {...defaultProps} data={data} />
      );
      const input = screen.getByRole("textbox", { name: /Campo/i });
      expect(input).toHaveValue("prefilled");
    });

    it("calls onCancel (onBack) when Cancelar is clicked", () => {
      const onBack = vi.fn();
      renderWithRequestQuoteProviders(
        <Step2ServiceForm {...defaultProps} onBack={onBack} />
      );
      fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("calls onDataChange and onComplete with formData and schema when form is completed", async () => {
      const onDataChange = vi.fn();
      const onComplete = vi.fn();
      renderWithRequestQuoteProviders(
        <Step2ServiceForm
          {...defaultProps}
          onDataChange={onDataChange}
          onComplete={onComplete}
        />
      );
      const input = screen.getByRole("textbox", { name: /Campo/i });
      fireEvent.change(input, { target: { value: "test value" } });
      fireEvent.click(screen.getByRole("button", { name: /Concluir/i }));

      await waitFor(() => {
        expect(onDataChange).toHaveBeenCalledTimes(1);
        expect(onDataChange).toHaveBeenCalledWith(
          expect.objectContaining({ field1: "test value" })
        );
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({ field1: "test value" }),
          mockFormSchema
        );
      });
    });
  });

  describe("edge cases", () => {
    it("handles serviceSlug and serviceId null without crashing", () => {
      useServiceSchema.mockReturnValue({
        schema: null,
        fallbackReason: "no_service_slug_or_id",
        isLoading: false,
      });
      render(
        <Step2ServiceForm
          {...defaultProps}
          serviceSlug={null}
          serviceId={null}
        />
      );
      expect(screen.getByText("Formulário não configurado")).toBeInTheDocument();
      expect(screen.getByText("Motivo: no_service_slug_or_id")).toBeInTheDocument();
    });
  });
});
