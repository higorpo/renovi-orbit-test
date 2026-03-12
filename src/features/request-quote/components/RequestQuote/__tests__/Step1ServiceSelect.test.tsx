import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SERVICE_PLACEHOLDER_IMAGE } from "../../../utils/serviceCardStyle";
import { Step1ServiceSelect } from "../Step1ServiceSelect";
import {
  mockServicesList,
  mockServiceWithChildren,
  mockServiceWithChildrenNested,
} from "./fixtures/requestQuoteTestFixtures";

vi.mock("../../../hooks/useRequestQuoteServices", () => ({
  useRequestQuoteServices: vi.fn(),
}));

const useRequestQuoteServices = await import(
  "../../../hooks/useRequestQuoteServices"
).then((m) => vi.mocked(m.useRequestQuoteServices));

describe("Step1ServiceSelect", () => {
  const onServiceSelect = vi.fn();

  beforeEach(() => {
    vi.mocked(useRequestQuoteServices).mockReturnValue({
      services: mockServicesList,
      isLoading: false,
      error: null,
    });
    onServiceSelect.mockClear();
  });

  it("renders title Escolha o tipo de serviço", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Escolha o tipo de serviço" })
    ).toBeInTheDocument();
  });

  it("renders flat list of services (root + children)", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const buttons = screen.getAllByRole("button");
    const titles = buttons.map((b) => b.textContent ?? "").join(" ");
    expect(titles).toMatch(/Limpeza/);
    expect(titles).toMatch(/Root Service/);
    expect(titles).toMatch(/Child 1/);
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("each service button shows title and image with correct src and alt", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const limpezaImages = screen.getAllByAltText("Serviço de limpeza");
    expect(limpezaImages.length).toBeGreaterThanOrEqual(1);
    const withCorrectSrc = limpezaImages.find(
      (i) => i.getAttribute("src") === "https://example.com/limpeza.jpg"
    );
    expect(withCorrectSrc).toBeDefined();
    expect(screen.getByText("Root Service")).toBeInTheDocument();
  });

  it("calls onServiceSelect with service when a service button is clicked", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const limpezaButtons = screen.getAllByRole("button").filter((b) => b.querySelector('[title="Limpeza"]'));
    fireEvent.click(limpezaButtons[0]!);
    expect(onServiceSelect).toHaveBeenCalledTimes(1);
    expect(onServiceSelect).toHaveBeenCalledWith(mockServiceWithChildren);
  });

  it("shows selected state (ring-accent) and check for selectedService", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={mockServiceWithChildren}
        onServiceSelect={onServiceSelect}
      />
    );
    const selectedButton = screen.getAllByRole("button").find(
      (b) => b.className.includes("ring-2") && b.className.includes("ring-accent") && b.className.includes("scale-[1.02]")
    );
    expect(selectedButton).toBeDefined();
    expect(selectedButton).toHaveClass("ring-accent");
  });

  it("shows Carregando serviços when isLoading is true", () => {
    useRequestQuoteServices.mockReturnValue({
      services: [],
      isLoading: true,
      error: null,
    });
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    expect(screen.getByText("Carregando serviços...")).toBeInTheDocument();
  });

  it("shows Nenhum serviço disponível when not loading, empty services, no error", () => {
    useRequestQuoteServices.mockReturnValue({
      services: [],
      isLoading: false,
      error: null,
    });
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    expect(
      screen.getByText("Nenhum serviço disponível no momento.")
    ).toBeInTheDocument();
  });

  it("passes urlServiceSlug and loadingSession to useRequestQuoteServices", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug="limpeza-profunda"
        loadingSession={true}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    expect(useRequestQuoteServices).toHaveBeenCalledWith({
      urlServiceSlug: "limpeza-profunda",
      loadingSession: true,
      onServiceSelect,
    });
  });

  it("uses SERVICE_PLACEHOLDER_IMAGE when service has no image_url", () => {
    const servicesNoImage = [
      { ...mockServiceWithChildren, id: "no-img", image_url: null as string | null },
    ];
    useRequestQuoteServices.mockReturnValue({
      services: servicesNoImage,
      isLoading: false,
      error: null,
    });
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const img = screen.getByAltText("Serviço de limpeza");
    expect(img).toHaveAttribute("src", SERVICE_PLACEHOLDER_IMAGE);
  });

  it("image onError sets src to SERVICE_PLACEHOLDER_IMAGE", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const images = screen.getAllByAltText("Serviço de limpeza");
    const img = images[0];
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/limpeza.jpg");
    fireEvent.error(img!, { target: img });
    expect(img).toHaveAttribute("src", SERVICE_PLACEHOLDER_IMAGE);
  });

  it("service without description uses title for image alt", () => {
    const servicesNoDesc = [
      {
        ...mockServiceWithChildren,
        id: "no-desc",
        title: "Sem Descrição",
        description: null as string | null,
      },
    ];
    useRequestQuoteServices.mockReturnValue({
      services: servicesNoDesc,
      isLoading: false,
      error: null,
    });
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const img = screen.getByAltText("Sem Descrição");
    expect(img).toBeInTheDocument();
  });

  it("renders footer text with no charge message", () => {
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    expect(
      screen.getByText(/Selecione um serviço para continuar/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma cobrança será feita agora.")
    ).toBeInTheDocument();
  });

  it("empty grid when services is empty does not throw", () => {
    useRequestQuoteServices.mockReturnValue({
      services: [],
      isLoading: false,
      error: null,
    });
    const { container } = render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpeza/i })).not.toBeInTheDocument();
  });

  it("when error is set and services empty, does not show Nenhum serviço disponível", () => {
    useRequestQuoteServices.mockReturnValue({
      services: [],
      isLoading: false,
      error: "Network error",
    });
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    expect(screen.queryByText("Nenhum serviço disponível no momento.")).not.toBeInTheDocument();
  });

  it("renders only root when root has empty children array", () => {
    const rootNoChildren = [
      { ...mockServiceWithChildrenNested, id: "root-only", children: [] },
    ];
    useRequestQuoteServices.mockReturnValue({
      services: rootNoChildren,
      isLoading: false,
      error: null,
    });
    render(
      <Step1ServiceSelect
        urlServiceSlug={null}
        loadingSession={false}
        selectedService={null}
        onServiceSelect={onServiceSelect}
      />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(screen.getByText("Root Service")).toBeInTheDocument();
    expect(screen.queryByText("Child 1")).not.toBeInTheDocument();
  });
});
