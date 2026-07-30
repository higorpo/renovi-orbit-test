import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { KycStatusLayout } from "../KycStatusLayout";

describe("KycStatusLayout", () => {
  it("renders title, body and support CTA by default", () => {
    render(
      <KycStatusLayout
        icon={Clock}
        title="Em análise"
        body="Aguarde a revisão."
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Em análise" })).toBeInTheDocument();
    expect(screen.getByText("Aguarde a revisão.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Falar com suporte/i })).toBeInTheDocument();
  });

  it("hides support CTA and renders optional action/children", () => {
    render(
      <KycStatusLayout
        icon={Clock}
        title="Enviando"
        body="Aguarde."
        showSupportCta={false}
        action={<button type="button">Tentar de novo</button>}
      >
        <div>extra-progress</div>
      </KycStatusLayout>,
    );

    expect(screen.getByText("extra-progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar de novo/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Falar com suporte/i })).toBeNull();
  });

  it("omits action footer when support CTA is off and no action is provided", () => {
    render(
      <KycStatusLayout
        icon={Clock}
        title="Processando"
        body="Sem ações."
        showSupportCta={false}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
