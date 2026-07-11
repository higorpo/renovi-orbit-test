// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatListServiceRequestFilterBanner } from "../ChatListServiceRequestFilterBanner";

const useServiceMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/view-services", () => ({
  useService: (...args: unknown[]) => useServiceMock(...args),
}));

describe("ChatListServiceRequestFilterBanner", () => {
  it("shows loading copy while the service request is fetching", () => {
    useServiceMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(
      <ChatListServiceRequestFilterBanner
        serviceRequestId="sr-1"
        onClearFilter={vi.fn()}
      />,
    );

    expect(screen.getByText("Carregando conversas deste pedido…")).toBeTruthy();
  });

  it("includes the service title when available", () => {
    useServiceMock.mockReturnValue({
      data: { title: "Troca de chuveiro" },
      isLoading: false,
      isError: false,
    });
    const onClearFilter = vi.fn();

    render(
      <ChatListServiceRequestFilterBanner
        serviceRequestId="sr-1"
        onClearFilter={onClearFilter}
      />,
    );

    expect(
      screen.getByText(
        'Mostrando conversas com prestadores sobre “Troca de chuveiro”.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver todas as conversas" }));
    expect(onClearFilter).toHaveBeenCalledOnce();
  });

  it("shows an error description when the service request fails to load", () => {
    useServiceMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(
      <ChatListServiceRequestFilterBanner
        serviceRequestId="sr-1"
        onClearFilter={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Não foi possível carregar os detalhes deste pedido."),
    ).toBeTruthy();
  });

  it("falls back to generic copy when title is missing", () => {
    useServiceMock.mockReturnValue({
      data: { title: null },
      isLoading: false,
      isError: false,
    });

    render(
      <ChatListServiceRequestFilterBanner
        serviceRequestId="sr-1"
        onClearFilter={vi.fn()}
      />,
    );

    expect(screen.getByText("Mostrando conversas deste pedido de serviço.")).toBeTruthy();
  });
});
