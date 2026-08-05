// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormBlock } from "../../../types";
import { CompletionCriterionBlock } from "../CompletionCriterionBlock";

const block: FormBlock = {
  id: "c1",
  type: "completion_criterion",
  label: "Piso limpo e seco",
  required: true,
  description_ai: "Criterion",
  helpText: "Verifique o piso",
  config: {
    requires_evidence_when_met: false,
    evidence_min: 1,
    evidence_max: 5,
  },
};

describe("CompletionCriterionBlock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders label, help, and met/not-met options", () => {
    render(
      <CompletionCriterionBlock block={block} value={undefined} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/Piso limpo e seco/i)).toBeInTheDocument();
    expect(screen.getByText(/Verifique o piso/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Atendido" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Não atendido" })).toBeInTheDocument();
  });

  it("calls onChange with met=true when Atendido is selected", () => {
    const onChange = vi.fn();
    render(
      <CompletionCriterionBlock block={block} value={undefined} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Atendido" }));
    expect(onChange).toHaveBeenCalledWith({
      met: true,
      justification: "",
      evidence_paths: [],
    });
  });

  it("shows justification when Não atendido is selected", () => {
    const onChange = vi.fn();
    render(
      <CompletionCriterionBlock
        block={block}
        value={{ met: false, evidence_paths: [] }}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText(/Justificativa/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Justificativa/i), {
      target: { value: "Mancha residual" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        met: false,
        justification: "Mancha residual",
      }),
    );
  });

  it("shows evidence section when unmet without inventing demo paths", () => {
    const onChange = vi.fn();
    render(
      <CompletionCriterionBlock
        block={block}
        value={{ met: false, justification: "x", evidence_paths: [] }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/Nenhuma foto anexada/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Adicionar foto/i }),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("invokes onUploadEvidenceFile flow when provided", async () => {
    const onUploadEvidenceFile = vi.fn().mockResolvedValue("cs/sess/obj.jpg");
    const onChange = vi.fn();
    render(
      <CompletionCriterionBlock
        block={block}
        value={{ met: false, justification: "x", evidence_paths: [] }}
        onChange={onChange}
        onUploadEvidenceFile={onUploadEvidenceFile}
      />,
    );
    expect(screen.getByRole("button", { name: /Adicionar foto/i })).toBeInTheDocument();
  });

  it("invokes onRequestEvidenceUpload when provided", async () => {
    const onRequestEvidenceUpload = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    render(
      <CompletionCriterionBlock
        block={block}
        value={{ met: false, justification: "x", evidence_paths: [] }}
        onChange={onChange}
        onRequestEvidenceUpload={onRequestEvidenceUpload}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Adicionar foto/i }));
    });
    expect(onRequestEvidenceUpload).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows required error after blur without selection", () => {
    render(
      <CompletionCriterionBlock block={block} value={undefined} onChange={vi.fn()} />,
    );
    fireEvent.blur(screen.getByRole("radio", { name: "Atendido" }));
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/critério/i);
  });
});
