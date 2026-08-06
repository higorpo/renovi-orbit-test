// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompletionEvidenceGallery } from "../CompletionEvidenceGallery";

const photoUrlsMock = vi.hoisted(() => ({
  urls: [] as string[],
  isLoading: false,
}));

vi.mock("../../hooks/useCompletionEvidencePhotoUrls", () => ({
  useCompletionEvidencePhotoUrls: () => photoUrlsMock,
}));

describe("CompletionEvidenceGallery", () => {
  beforeEach(() => {
    photoUrlsMock.isLoading = false;
    photoUrlsMock.urls = [];
  });

  it("shows empty copy when there are no paths", () => {
    render(<CompletionEvidenceGallery paths={[]} />);
    expect(screen.getByText(/Nenhuma foto anexada/i)).toBeInTheDocument();
  });

  it("shows loading skeletons while urls resolve", () => {
    photoUrlsMock.isLoading = true;
    const { container } = render(
      <CompletionEvidenceGallery paths={["a.jpg", "b.jpg"]} />,
    );
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
  });

  it("opens lightbox when a thumbnail is clicked", async () => {
    photoUrlsMock.urls = ["https://cdn/a.jpg"];
    render(<CompletionEvidenceGallery paths={["a.jpg"]} />);

    fireEvent.click(screen.getByRole("button", { name: /Ampliar evidência 1/i }));
    expect(screen.getByRole("img", { name: /Evidência ampliada/i })).toHaveAttribute(
      "src",
      "https://cdn/a.jpg",
    );

    fireEvent.click(screen.getByRole("button", { name: /Fechar imagem ampliada/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole("img", { name: /Evidência ampliada/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("allows removing a photo when editable", () => {
    photoUrlsMock.urls = ["https://cdn/a.jpg"];
    const onRemovePath = vi.fn();
    render(
      <CompletionEvidenceGallery
        paths={["a.jpg"]}
        onRemovePath={onRemovePath}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Remover evidência 1/i }));
    expect(onRemovePath).toHaveBeenCalledWith("a.jpg");
  });
});
