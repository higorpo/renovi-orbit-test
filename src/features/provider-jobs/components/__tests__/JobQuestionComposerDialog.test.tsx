import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobQuestionComposerDialog } from "../JobQuestionComposerDialog";

const scheduleSync = vi.fn();

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: vi.fn(),
    scheduleSync,
  }),
}));

describe("JobQuestionComposerDialog", () => {
  it("calls scheduleSync when textarea is focused", () => {
    const onQuestionDraftChange = vi.fn();
    render(
      <JobQuestionComposerDialog
        open
        questionDraft=""
        isSubmitting={false}
        maxQuestionLength={500}
        onOpenChange={vi.fn()}
        onQuestionDraftChange={onQuestionDraftChange}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByPlaceholderText(/local possui/i));
    expect(scheduleSync).toHaveBeenCalled();
  });

  it("shows destructive counter and disables submit when over limit", () => {
    const longText = "x".repeat(501);
    render(
      <JobQuestionComposerDialog
        open
        questionDraft={longText}
        isSubmitting={false}
        maxQuestionLength={500}
        onOpenChange={vi.fn()}
        onQuestionDraftChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const counter = screen.getByText(/501\/500/);
    expect(counter.className).toContain("destructive");
    expect(screen.getByRole("button", { name: /enviar pergunta/i })).toBeDisabled();
  });

  it("shows sending state while submitting", () => {
    render(
      <JobQuestionComposerDialog
        open
        questionDraft="ok"
        isSubmitting
        maxQuestionLength={500}
        onOpenChange={vi.fn()}
        onQuestionDraftChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(/enviando/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });

  it("submits through form handler", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onQuestionDraftChange = vi.fn();
    render(
      <JobQuestionComposerDialog
        open
        questionDraft=""
        isSubmitting={false}
        maxQuestionLength={500}
        onOpenChange={vi.fn()}
        onQuestionDraftChange={onQuestionDraftChange}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/local possui/i), {
      target: { value: "Pergunta válida?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^enviar pergunta$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onQuestionDraftChange).toHaveBeenCalled();
  });
});
