import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobQuestionPromptCard } from "../JobQuestionPromptCard";

describe("JobQuestionPromptCard", () => {
  it("calls onAskQuestion when primary button is clicked", () => {
    const onAskQuestion = vi.fn();
    render(
      <JobQuestionPromptCard
        suggestedQuestions={[]}
        onAskQuestion={onAskQuestion}
        onUseSuggestedQuestion={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /fazer pergunta/i }));
    expect(onAskQuestion).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when there are no suggested questions", async () => {
    render(
      <JobQuestionPromptCard
        suggestedQuestions={[]}
        onAskQuestion={vi.fn()}
        onUseSuggestedQuestion={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ver perguntas sugeridas/i }));
    expect(
      await screen.findByText(/não há perguntas sugeridas/i),
    ).toBeInTheDocument();
  });

  it("lists suggested questions and fires onUseSuggestedQuestion", async () => {
    const onUseSuggestedQuestion = vi.fn();
    render(
      <JobQuestionPromptCard
        suggestedQuestions={["Prazo?", "Material incluso?"]}
        onAskQuestion={vi.fn()}
        onUseSuggestedQuestion={onUseSuggestedQuestion}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ver perguntas sugeridas/i }));
    expect(screen.getByText("Prazo?")).toBeInTheDocument();

    const useButtons = screen.getAllByRole("button", { name: /usar pergunta sugerida/i });
    fireEvent.click(useButtons[0]!);
    expect(onUseSuggestedQuestion).toHaveBeenCalledWith("Prazo?");
  });
});
