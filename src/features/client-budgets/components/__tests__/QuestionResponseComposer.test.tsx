import { createRef } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QuestionResponseComposer } from "../QuestionResponseComposer";

const submit = vi.fn().mockResolvedValue(true);
const setResponseText = vi.fn();
const onSelectImages = vi.fn();
const removeImage = vi.fn();

const composerMock = {
  responseText: "",
  setResponseText,
  selectedImages: [] as File[],
  onSelectImages,
  removeImage,
  submit,
  isSubmitting: false,
  canSubmit: true,
  maxImages: 5,
  maxTextLength: 1000,
};

vi.mock("../../hooks/useQuestionResponseComposer", () => ({
  useQuestionResponseComposer: () => composerMock,
}));

const dialogContentRef = createRef<HTMLDivElement>();

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: dialogContentRef,
    scheduleSync: vi.fn(),
  }),
}));

describe("QuestionResponseComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog and wires cancel", () => {
    const onOpenChange = vi.fn();
    render(
      <QuestionResponseComposer
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr1"
        questionId="q1"
      />,
    );
    expect(screen.getByText(/Responder pergunta/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits via form and closes on success", async () => {
    const onOpenChange = vi.fn();
    render(
      <QuestionResponseComposer
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr1"
        questionId="q1"
      />,
    );
    fireEvent.change(screen.getByLabelText(/Sua resposta/i), {
      target: { value: "Minha resposta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/i }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
