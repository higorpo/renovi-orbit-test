import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientMyServicesPhotoGallery } from "../ClientMyServicesPhotoGallery";

const useServiceRequestPhotoUrls = vi.fn();

vi.mock("@/features/request-quote", () => ({
  useServiceRequestPhotoUrls: (...args: unknown[]) => useServiceRequestPhotoUrls(...args),
}));

describe("ClientMyServicesPhotoGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton placeholders while loading", () => {
    useServiceRequestPhotoUrls.mockReturnValue({ urls: [], isLoading: true });
    const { container } = render(<ClientMyServicesPhotoGallery photos={["a", "b", "c"]} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders clickable thumbnails and opens lightbox", () => {
    useServiceRequestPhotoUrls.mockReturnValue({
      urls: ["https://example.com/1.jpg"],
      isLoading: false,
    });
    render(<ClientMyServicesPhotoGallery photos={["path/1"]} />);

    fireEvent.click(screen.getByRole("button", { name: /Ampliar foto 1/i }));
    expect(screen.getByRole("img", { name: /Imagem ampliada do pedido/i })).toBeInTheDocument();
  });

  it("returns null when there are no resolved urls", () => {
    useServiceRequestPhotoUrls.mockReturnValue({ urls: [], isLoading: false });
    const { container } = render(<ClientMyServicesPhotoGallery photos={["x"]} />);
    expect(container.firstChild).toBeNull();
  });

  it("hides image on load error and renders placeholder slot for null url", () => {
    useServiceRequestPhotoUrls.mockReturnValue({
      urls: ["https://example.com/bad.jpg", null as unknown as string],
      isLoading: false,
    });
    render(<ClientMyServicesPhotoGallery photos={["a", "b"]} />);
    const imgs = screen.getAllByRole("img");
    const first = imgs.find((el) => el.getAttribute("alt") === "Foto 1");
    expect(first).toBeTruthy();
    fireEvent.error(first!);
    expect(first).toHaveStyle({ display: "none" });
  });

  it("closes expanded dialog via onOpenChange(false)", () => {
    useServiceRequestPhotoUrls.mockReturnValue({
      urls: ["https://example.com/ok.jpg"],
      isLoading: false,
    });
    render(<ClientMyServicesPhotoGallery photos={["p"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Ampliar foto 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /Fechar imagem ampliada/i }));
  });
});
