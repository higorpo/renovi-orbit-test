import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

describe("ServiceSupportHelpCard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders copy and support link from VITE_MAIN_SITE_URL", async () => {
    vi.stubEnv("VITE_MAIN_SITE_URL", "https://prestway.test/");
    const { ServiceSupportHelpCard } = await import("../ServiceSupportHelpCard");

    render(<ServiceSupportHelpCard />);

    expect(screen.getByTestId("service-support-help-card")).toBeInTheDocument();
    expect(screen.getByText("Precisa de ajuda?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nossa equipe está pronta para te ajudar em qualquer etapa do processo.",
      ),
    ).toBeInTheDocument();

    const cta = screen.getByTestId("service-support-help-cta");
    expect(cta).toHaveAttribute("href", "https://prestway.test/suporte");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveTextContent("Falar com o suporte");
  });

  it("hides the CTA when VITE_MAIN_SITE_URL is unset", async () => {
    vi.stubEnv("VITE_MAIN_SITE_URL", "");
    const { ServiceSupportHelpCard } = await import("../ServiceSupportHelpCard");

    render(<ServiceSupportHelpCard />);

    expect(screen.getByTestId("service-support-help-card")).toBeInTheDocument();
    expect(screen.queryByTestId("service-support-help-cta")).not.toBeInTheDocument();
  });
});
