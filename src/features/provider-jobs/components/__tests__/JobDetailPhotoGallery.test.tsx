import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobDetailPhotoGallery } from "../JobDetailPhotoGallery";

const mockPhotoUrls = vi.hoisted(() => vi.fn());

vi.mock("@/features/request-quote", () => ({
  useServiceRequestPhotoUrls: () => mockPhotoUrls(),
}));

describe("JobDetailPhotoGallery", () => {
  beforeEach(() => {
    mockPhotoUrls.mockReset();
  });

  it("shows pulse placeholders while loading", () => {
    mockPhotoUrls.mockReturnValue({ urls: [], isLoading: true });
    render(<JobDetailPhotoGallery photos={["a", "b"]} />);
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("returns null when loaded with no urls", () => {
    mockPhotoUrls.mockReturnValue({ urls: [], isLoading: false });
    const { container } = render(<JobDetailPhotoGallery photos={["x"]} />);
    expect(container.firstChild).toBeNull();
  });

  it("opens fullscreen dialog when a thumbnail is clicked", () => {
    mockPhotoUrls.mockReturnValue({
      urls: ["https://cdn.example.com/p.jpg"],
      isLoading: false,
    });
    render(<JobDetailPhotoGallery photos={["path/x.jpg"]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /ampliar foto 1/i }),
    );
    expect(screen.getByRole("img", { name: /imagem ampliada/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /fechar imagem ampliada/i }));
  });

  it("hides broken thumbnails on image error", () => {
    mockPhotoUrls.mockReturnValue({
      urls: ["https://cdn.example.com/broken.jpg"],
      isLoading: false,
    });
    render(<JobDetailPhotoGallery photos={["path/x.jpg"]} />);
    const thumb = screen.getByRole("img", { name: /foto 1/i });
    fireEvent.error(thumb);
    expect(getComputedStyle(thumb).display).toBe("none");
  });
});
