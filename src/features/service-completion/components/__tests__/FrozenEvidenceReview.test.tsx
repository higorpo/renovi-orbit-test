// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FrozenEvidenceReview } from "../FrozenEvidenceReview";

const schema = {
  version: 1,
  blocks: [
    {
      id: "c1",
      type: "completion_criterion",
      label: "Trabalho concluído?",
      required: true,
      config: { requires_evidence_when_met: false },
    },
    {
      id: "c2",
      type: "completion_criterion",
      label: "Área limpa?",
      required: true,
      config: { requires_evidence_when_met: false },
    },
  ],
};

describe("FrozenEvidenceReview", () => {
  it("highlights unmet criteria", () => {
    render(
      <FrozenEvidenceReview
        checklistSchema={schema}
        responses={{
          c1: { met: true, evidence_paths: [] },
          c2: {
            met: false,
            justification: "Faltou acabamento",
            evidence_paths: ["a.jpg"],
          },
        }}
      />,
    );

    expect(screen.queryByTestId("executed-late-badge")).not.toBeInTheDocument();
    const unmet = screen.getByText(/Critério não atendido/i);
    expect(unmet).toBeInTheDocument();
    expect(screen.getByText("Área limpa?")).toBeInTheDocument();
  });

  it("shows auto-executed alert instead of checklist criteria", () => {
    render(
      <FrozenEvidenceReview
        checklistSchema={schema}
        autoExecutedWithoutChecklist
        responses={{}}
      />,
    );

    expect(
      screen.getByTestId("auto-executed-without-checklist-alert"),
    ).toHaveTextContent(/prestador não registrou/i);
    expect(screen.queryByText("Trabalho concluído?")).not.toBeInTheDocument();
  });
});
