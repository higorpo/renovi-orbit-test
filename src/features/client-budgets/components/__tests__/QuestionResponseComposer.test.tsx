import { createRef } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QuestionResponseComposer } from "../QuestionResponseComposer";

const setResponseText = vi.fn();
const onSelectImages = vi.fn();
const removeImage = vi.fn();
const submit = vi.fn().mockResolvedValue(true);

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

function resetComposerMock() {
  composerMock.responseText = "";
  composerMock.selectedImages = [];
  composerMock.isSubmitting = false;
  composerMock.canSubmit = true;
  submit.mockReset();
  submit.mockResolvedValue(true);
  setResponseText.mockClear();
  onSelectImages.mockClear();
  removeImage.mockClear();
}

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
    resetComposerMock();
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

  it("does not close when submit returns false", async () => {
    submit.mockResolvedValue(false);
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
      target: { value: "texto" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/i }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows submitting state on the primary button", () => {
    composerMock.isSubmitting = true;
    composerMock.canSubmit = false;
    render(
      <QuestionResponseComposer
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr1"
        questionId="q1"
      />,
    );
    expect(screen.getByRole("button", { name: /Enviando/i })).toBeInTheDocument();
  });

  it("forwards file selection to composer and clears input value", () => {
    render(
      <QuestionResponseComposer
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr1"
        questionId="q1"
      />,
    );
    const input = document.getElementById("client-question-images") as HTMLInputElement;
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onSelectImages).toHaveBeenCalled();
    expect(input.value).toBe("");
  });

  it("removes an image from preview and calls composer.removeImage", () => {
    composerMock.selectedImages = [new File(["a"], "a.png", { type: "image/png" })];
    render(
      <QuestionResponseComposer
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr1"
        questionId="q1"
      />,
    );
    const img = screen.getByRole("img", { name: /Imagem 1/i });
    const removeBtn = img.parentElement?.querySelector("button[type='button']");
    expect(removeBtn).toBeTruthy();
    fireEvent.click(removeBtn!);
    expect(removeImage).toHaveBeenCalledWith(0);
  });
});
