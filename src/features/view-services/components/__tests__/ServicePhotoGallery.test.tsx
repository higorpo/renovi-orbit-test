// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServicePhotoGallery } from "../ServicePhotoGallery";

const photoUrlsMock = vi.hoisted(() => ({
  urls: [] as (string | null)[],
  isLoading: false,
}));

vi.mock("@/features/request-quote", () => ({
  useServiceRequestPhotoUrls: () => photoUrlsMock,
}));

describe("ServicePhotoGallery", () => {
  it("shows loading placeholders", () => {
    photoUrlsMock.isLoading = true;
    photoUrlsMock.urls = [];
    const { container } = render(<ServicePhotoGallery photos={["a.jpg", "b.jpg"]} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
  });

  it("returns null when there are no urls", () => {
    photoUrlsMock.isLoading = false;
    photoUrlsMock.urls = [];
    const { container } = render(<ServicePhotoGallery photos={["a.jpg"]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders photos and opens the lightbox", () => {
    photoUrlsMock.isLoading = false;
    photoUrlsMock.urls = ["https://cdn/a.jpg", null];
    render(<ServicePhotoGallery photos={["a.jpg", "b.jpg"]} />);

    expect(screen.getByRole("list", { name: "Fotos do pedido" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar foto 1" }));
    expect(screen.getByAltText("Imagem ampliada do pedido")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar imagem ampliada" }));
  });

  it("hides broken images via onError", () => {
    photoUrlsMock.isLoading = false;
    photoUrlsMock.urls = ["https://cdn/broken.jpg"];
    render(<ServicePhotoGallery photos={["broken.jpg"]} />);
    const img = screen.getByAltText("Foto 1") as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe("none");
  });
});
