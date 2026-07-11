import { fireEvent, render, screen } from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { ProposalComposerFormValues } from "../../types/proposalComposer.types";
import { ProposalComposer } from "../ProposalComposer";

function ComposerHarness({
  durationUnit = "hours" as const,
  slotCount = 1,
  pricing = null as
    | { original_amount: number; tax_rate: number; tax_amount: number; final_amount: number }
    | null,
  isPricingLoading = false,
  existingPhotoUrls = [] as string[],
  newPhotos = [] as File[],
  onPhotoAdd = vi.fn(),
  onExistingPhotoRemove = vi.fn(),
  onNewPhotoRemove = vi.fn(),
  onAvailabilitySlotAdd = vi.fn(),
  onAvailabilitySlotRemove = vi.fn(),
  onInputFocus = vi.fn(),
}) {
  const form = useForm<ProposalComposerFormValues>({
    defaultValues: {
      priceInput: "",
      descriptionDraft: "",
      durationValueInput: "2",
      durationUnit,
      availabilitySlots: Array.from({ length: slotCount }, () => ({
        startDate: "2030-06-01",
        endDate: "2030-06-02",
        shift: "morning" as const,
      })),
    },
  });
  const availabilityFieldArray = useFieldArray({
    control: form.control,
    name: "availabilitySlots",
  });

  return (
    <ProposalComposer
      form={form}
      availabilityFieldArray={availabilityFieldArray}
      existingPhotoUrls={existingPhotoUrls}
      newPhotos={newPhotos}
      photosCount={existingPhotoUrls.length + newPhotos.length}
      pricing={pricing}
      isPricingLoading={isPricingLoading}
      maxDescriptionLength={2000}
      onPhotoAdd={onPhotoAdd}
      onExistingPhotoRemove={onExistingPhotoRemove}
      onNewPhotoRemove={onNewPhotoRemove}
      onAvailabilitySlotAdd={onAvailabilitySlotAdd}
      onAvailabilitySlotRemove={onAvailabilitySlotRemove}
      onInputFocus={onInputFocus}
    />
  );
}

describe("ProposalComposer", () => {
  it("masks price input and shows character count", () => {
    const onInputFocus = vi.fn();
    render(<ComposerHarness onInputFocus={onInputFocus} />);

    const price = screen.getByLabelText("Quanto você quer cobrar?");
    fireEvent.focus(price);
    fireEvent.change(price, { target: { value: "1500" } });

    expect(price).toHaveValue("1.500");
    expect(onInputFocus).toHaveBeenCalled();
    expect(screen.getByText("0/2000 caracteres")).toBeInTheDocument();
  });

  it("shows pricing skeleton while loading", () => {
    render(<ComposerHarness isPricingLoading />);
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders pricing breakdown when available", () => {
    render(
      <ComposerHarness
        pricing={{
          original_amount: 500,
          tax_rate: 0.1,
          tax_amount: 50,
          final_amount: 450,
        }}
      />,
    );

    expect(screen.getByText(/Valor informado/)).toBeInTheDocument();
    expect(screen.getByText(/Taxa da plataforma \(10%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Você recebe/)).toBeInTheDocument();
  });

  it("shows end date and day-range hint when duration unit is days", () => {
    render(<ComposerHarness durationUnit="days" />);

    expect(screen.getByLabelText("Data de início")).toBeInTheDocument();
    expect(screen.getByLabelText("Data de fim")).toBeInTheDocument();
    expect(screen.getByText(/Intervalo:/)).toBeInTheDocument();
  });

  it("adds availability slots and keeps remove disabled for a single option", () => {
    const onAvailabilitySlotAdd = vi.fn();
    const onAvailabilitySlotRemove = vi.fn();
    render(
      <ComposerHarness
        onAvailabilitySlotAdd={onAvailabilitySlotAdd}
        onAvailabilitySlotRemove={onAvailabilitySlotRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adicionar opção" }));
    expect(onAvailabilitySlotAdd).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Remover" })).toBeDisabled();
    expect(onAvailabilitySlotRemove).not.toHaveBeenCalled();
  });

  it("updates duration fields and removes an extra availability slot", () => {
    const onAvailabilitySlotRemove = vi.fn();
    render(
      <ComposerHarness slotCount={2} onAvailabilitySlotRemove={onAvailabilitySlotRemove} />,
    );

    fireEvent.change(screen.getByLabelText("Medido em"), { target: { value: "days" } });
    expect(screen.getByLabelText("Medido em")).toHaveValue("days");

    fireEvent.change(screen.getByLabelText("Tempo estimado"), { target: { value: "3a" } });
    expect(screen.getByLabelText("Tempo estimado")).toHaveValue("3");

    const removeButtons = screen.getAllByRole("button", { name: "Remover" });
    fireEvent.click(removeButtons[1]);
    expect(onAvailabilitySlotRemove).toHaveBeenCalledWith(1);
  });

  it("prevents native form submission", () => {
    const { container } = render(<ComposerHarness />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(submitEvent);
    expect(submitEvent.defaultPrevented).toBe(true);
  });

  it("forwards photo add and remove actions", () => {
    const onPhotoAdd = vi.fn();
    const onExistingPhotoRemove = vi.fn();
    const onNewPhotoRemove = vi.fn();
    const file = new File(["x"], "foto.png", { type: "image/png" });

    render(
      <ComposerHarness
        existingPhotoUrls={["https://cdn.example/a.jpg"]}
        newPhotos={[file]}
        onPhotoAdd={onPhotoAdd}
        onExistingPhotoRemove={onExistingPhotoRemove}
        onNewPhotoRemove={onNewPhotoRemove}
      />,
    );

    expect(screen.getByText(/2\/5 imagens selecionadas/)).toBeInTheDocument();
    expect(screen.getByText("Imagem atual #1")).toBeInTheDocument();
    expect(screen.getByText("foto.png")).toBeInTheDocument();

    const photoRemoveButtons = screen
      .getAllByRole("button", { name: "Remover" })
      .filter((button) => !(button as HTMLButtonElement).disabled);
    fireEvent.click(photoRemoveButtons[0]);
    fireEvent.click(photoRemoveButtons[1]);
    expect(onExistingPhotoRemove).toHaveBeenCalledWith(0);
    expect(onNewPhotoRemove).toHaveBeenCalledWith(0);

    const input = document.getElementById("proposal-photos") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPhotoAdd).toHaveBeenCalled();
  });
});
