import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

import { Step3DescriptionPhotos } from "../Step3DescriptionPhotos";
import { mockRequestQuoteState } from "./fixtures/requestQuoteTestFixtures";
import { stableStringify } from "../../../utils/stableStringify";

const createObjectURL = vi.fn(() => "blob:mock-url-1");
const revokeObjectURL = vi.fn();

const mockGenerateSmartDescription = vi.fn();
vi.mock("../../../hooks/useGenerateSmartDescription", () => ({
  useGenerateSmartDescription: vi.fn(
    (params?: { onSuccess?: () => void; onFailure?: () => void }) => ({
      generateSmartDescription: async () => {
        try {
          const out = mockGenerateSmartDescription();
          await out;
          params?.onSuccess?.();
        } catch {
          params?.onFailure?.();
        }
      },
    })
  ),
}));

describe("Step3DescriptionPhotos", () => {
  let state: ReturnType<typeof mockRequestQuoteState>;
  let step2DataSnapshotRef: { current: string | null };

  beforeEach(() => {
    toastError.mockClear();
    state = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step2Data: { a: 1 },
      step3Data: {
        description: "",
        photos: [],
        photoPreviews: [],
      },
      generatingDescription: false,
    });
    step2DataSnapshotRef = { current: null };
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    mockGenerateSmartDescription.mockClear();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
  });

  it("renders SectionTitleWithIcon Descrição e Fotos and textarea when not generating", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(screen.getByText("Descrição e Fotos")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        /A descrição será gerada automaticamente/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders loading state when generatingDescription is true", () => {
    state = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      generatingDescription: true,
    });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(screen.getByText(/Gerando descrição profissional/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/A descrição será gerada/)).not.toBeInTheDocument();
  });

  it("calls setStep3Data with updated description when textarea changes", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "New description" } });
    expect(state.setStep3Data).toHaveBeenCalled();
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(typeof updater).toBe("function");
    const prev = { description: "", photos: [] as File[], photoPreviews: [] as string[] };
    expect(updater(prev)).toEqual({ ...prev, description: "New description" });
  });

  it("shows Fotos (Opcional) label and drop zone text", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(screen.getByText("Fotos (Opcional)")).toBeInTheDocument();
    expect(
      screen.getByText("Clique ou arraste e solte fotos aqui")
    ).toBeInTheDocument();
  });

  it("calls setStep3Data with new photos and previews when files are selected via input", () => {
    const file = new File(["content"], "test.png", { type: "image/png" });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    fireEvent.change(input!, { target: { files: [file] } });
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(state.setStep3Data).toHaveBeenCalled();
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(typeof updater).toBe("function");
    const prev = { description: "", photos: [] as File[], photoPreviews: [] as string[] };
    const result = updater(prev);
    expect(result.photos).toHaveLength(1);
    expect(result.photoPreviews).toHaveLength(1);
    expect(result.photoPreviews[0]).toBe("blob:mock-url-1");
  });

  it("processFiles with empty array does not call setStep3Data", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const input = document.querySelector('input[type="file"]');
    (state.setStep3Data as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.change(input!, { target: { files: [] } });
    expect(state.setStep3Data).not.toHaveBeenCalled();
  });

  it("handleFileInputChange treats null files as empty selection", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const input = document.querySelector('input[type="file"]');
    (state.setStep3Data as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.change(input!, { target: { files: null } } as unknown as { target: { files: FileList | null } });
    expect(state.setStep3Data).not.toHaveBeenCalled();
  });

  it("handleDrop treats null dataTransfer.files as empty", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const dropZone = screen.getByText("Clique ou arraste e solte fotos aqui").closest("div");
    (state.setStep3Data as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.drop(dropZone!, { dataTransfer: { files: null } });
    expect(state.setStep3Data).not.toHaveBeenCalled();
  });

  it("handleDrop adds files to state via processFiles", () => {
    const file = new File(["x"], "pic.jpg", { type: "image/jpeg" });
    const dataTransfer = { files: [file] };
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const dropZone = screen.getByText("Clique ou arraste e solte fotos aqui").closest("div");
    fireEvent.drop(dropZone!, { dataTransfer });
    expect(state.setStep3Data).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledWith(file);
  });

  it("handleDrop keeps valid files when batched with unsupported type", () => {
    const bad = new File(["x"], "x.gif", { type: "image/gif" });
    const ok = new File(["y"], "y.png", { type: "image/png" });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const dropZone = screen.getByText("Clique ou arraste e solte fotos aqui").closest("div");
    fireEvent.drop(dropZone!, { dataTransfer: { files: [bad, ok] } });
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("Formato não suportado"));
    expect(createObjectURL).toHaveBeenCalledWith(ok);
    expect(createObjectURL).not.toHaveBeenCalledWith(bad);
  });

  it("handleDragOver can be fired without throwing", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const dropZone = screen.getByText("Clique ou arraste e solte fotos aqui").closest("div");
    expect(() => fireEvent.dragOver(dropZone!)).not.toThrow();
  });

  it("shows photo previews and remove button when photoPreviews has items", () => {
    state = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step3Data: {
        description: "x",
        photos: [new File([], "a.png", { type: "image/png" })],
        photoPreviews: ["blob:url1"],
      },
      generatingDescription: false,
    });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();
    const removeButtons = screen.getAllByRole("button");
    expect(removeButtons.some((b) => b.closest(".relative.group"))).toBe(true);
  });

  it("calls setStep3Data filtering out photo at index when remove is clicked", () => {
    state = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step3Data: {
        description: "x",
        photos: [
          new File([], "a.png", { type: "image/png" }),
          new File([], "b.png", { type: "image/png" }),
        ],
        photoPreviews: ["blob:1", "blob:2"],
      },
      generatingDescription: false,
    });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const removeButtons = screen.getAllByRole("button").filter((btn) =>
      btn.className.includes("bg-red-500")
    );
    fireEvent.click(removeButtons[1]!);
    expect(state.setStep3Data).toHaveBeenCalled();
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const prev = {
      description: "x",
      photos: [new File([], "a.png"), new File([], "b.png")],
      photoPreviews: ["blob:1", "blob:2"],
    };
    const result = updater(prev);
    expect(result.photos).toHaveLength(1);
    expect(result.photoPreviews).toHaveLength(1);
  });

  it("shows helper text when no photos", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(
      screen.getByText(/Adicionar fotos ajuda os profissionais/)
    ).toBeInTheDocument();
  });

  it("useEffect calls generateSmartDescription when entering step 3 from step 2 and snapshot differs", () => {
    step2DataSnapshotRef.current = null;
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(mockGenerateSmartDescription).toHaveBeenCalled();
  });

  it("clears step2 snapshot ref on generateSmartDescription failure when under max attempts", async () => {
    mockGenerateSmartDescription.mockRejectedValueOnce(new Error("api down"));
    const ref: { current: string | null } = { current: null };
    const s = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step2Data: { id: "svc" },
    });
    render(<Step3DescriptionPhotos state={s} step2DataSnapshotRef={ref} />);
    await waitFor(() => {
      expect(mockGenerateSmartDescription).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(ref.current).toBeNull();
    });
  });

  it("useEffect does not call generateSmartDescription when currentStep is not 3", () => {
    state = mockRequestQuoteState({
      currentStep: 2,
      previousStep: 1,
      step2Data: { a: 1 },
      generatingDescription: false,
    });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(mockGenerateSmartDescription).not.toHaveBeenCalled();
  });

  it("useEffect does not call generateSmartDescription when previousStep is not 2", () => {
    state = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 4,
      step2Data: { a: 1 },
      generatingDescription: false,
    });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(mockGenerateSmartDescription).not.toHaveBeenCalled();
  });

  it("useEffect does not call generateSmartDescription when snapshot already equals step2Data key", () => {
    step2DataSnapshotRef.current = stableStringify(state.step2Data);
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(mockGenerateSmartDescription).not.toHaveBeenCalled();
  });

  it("useEffect does not call generateSmartDescription when generatingDescription is true", () => {
    state = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step2Data: { x: 1 },
      generatingDescription: true,
    });
    step2DataSnapshotRef.current = null;
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    expect(mockGenerateSmartDescription).not.toHaveBeenCalled();
  });

  it("processFiles appends multiple files from single input change", () => {
    const file1 = new File(["a"], "a.png", { type: "image/png" });
    const file2 = new File(["b"], "b.png", { type: "image/png" });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file1, file2] } });
    expect(createObjectURL).toHaveBeenCalledWith(file1);
    expect(createObjectURL).toHaveBeenCalledWith(file2);
    expect(state.setStep3Data).toHaveBeenCalled();
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const prev = { description: "", photos: [] as File[], photoPreviews: [] as string[] };
    const result = updater(prev);
    expect(result.photos).toHaveLength(2);
    expect(result.photoPreviews).toHaveLength(2);
  });

  it("shows toast and rejects file larger than 10MB", () => {
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [huge] } });
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("excede 10MB"));
    expect(state.setStep3Data).not.toHaveBeenCalled();
  });

  it("accepts valid files in the same batch after skipping an oversized file", () => {
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    const ok = new File(["x"], "ok.png", { type: "image/png" });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [huge, ok] } });
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("excede 10MB"));
    expect(state.setStep3Data).toHaveBeenCalled();
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const prev = { description: "", photos: [] as File[], photoPreviews: [] as string[] };
    const result = updater(prev);
    expect(result.photos).toEqual([ok]);
  });

  it("shows toast for unsupported image type", () => {
    const bad = new File(["x"], "doc.gif", { type: "image/gif" });
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [bad] } });
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("Formato não suportado"));
  });

  it("stops calling generateSmartDescription after max attempts for the same mount", async () => {
    mockGenerateSmartDescription.mockImplementation(() => Promise.resolve());
    const ref: { current: string | null } = { current: null };
    const s1 = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step2Data: { k: 1 },
    });
    const { rerender } = render(
      <Step3DescriptionPhotos state={s1} step2DataSnapshotRef={ref} />
    );
    await waitFor(() => expect(mockGenerateSmartDescription).toHaveBeenCalledTimes(1));
    const s2 = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step2Data: { k: 2 },
    });
    rerender(<Step3DescriptionPhotos state={s2} step2DataSnapshotRef={ref} />);
    await waitFor(() => expect(mockGenerateSmartDescription).toHaveBeenCalledTimes(2));
    const s3 = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step2Data: { k: 3 },
    });
    rerender(<Step3DescriptionPhotos state={s3} step2DataSnapshotRef={ref} />);
    await waitFor(() => expect(mockGenerateSmartDescription).toHaveBeenCalledTimes(3));
    const s4 = mockRequestQuoteState({
      currentStep: 3,
      previousStep: 2,
      step2Data: { k: 4 },
    });
    rerender(<Step3DescriptionPhotos state={s4} step2DataSnapshotRef={ref} />);
    await waitFor(() => {
      expect(mockGenerateSmartDescription).toHaveBeenCalledTimes(3);
    });
  });

  it("clicking drop zone does not throw and file input is present", () => {
    render(
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    );
    const dropZone = screen.getByText("Clique ou arraste e solte fotos aqui").closest("div");
    expect(dropZone).toBeInTheDocument();
    expect(() => fireEvent.click(dropZone!)).not.toThrow();
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
  });
});
