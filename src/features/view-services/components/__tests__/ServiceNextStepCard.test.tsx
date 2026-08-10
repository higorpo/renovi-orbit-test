import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceNextStepCard } from "../ServiceNextStepCard";
import type { ServiceNextStep } from "../../utils/serviceNextStep";

const step: ServiceNextStep = {
  intent: "adjust_payment",
  eyebrow: "Próximo passo",
  title: "Pagamento pendente",
  description: "Atualize suas informações de pagamento.",
  actionLabel: "Pagar agora",
  icon: "credit_card",
  trustFooter: { icon: "lock", text: "Ambiente seguro e criptografado" },
};

describe("ServiceNextStepCard", () => {
  it("renders eyebrow, title, CTA and trust footer", () => {
    const onAction = vi.fn();
    render(<ServiceNextStepCard step={step} onAction={onAction} />);

    expect(screen.getByTestId("service-next-step-card")).toBeInTheDocument();
    expect(screen.getByText("Próximo passo")).toBeInTheDocument();
    expect(screen.getByText("Pagamento pendente")).toBeInTheDocument();
    expect(screen.getByText("Ambiente seguro e criptografado")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("service-next-step-cta"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("disables CTA when step is disabled", () => {
    const onAction = vi.fn();
    render(
      <ServiceNextStepCard
        step={{ ...step, disabled: true, disabledReason: "Indisponível" }}
        onAction={onAction}
      />,
    );

    expect(screen.getByTestId("service-next-step-cta")).toBeDisabled();
    fireEvent.click(screen.getByTestId("service-next-step-cta"));
    expect(onAction).not.toHaveBeenCalled();
  });
});
