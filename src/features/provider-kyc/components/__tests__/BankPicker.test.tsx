// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankPicker } from "../BankPicker";
import { useBrazilianBanks } from "../../hooks/useBrazilianBanks";

vi.mock("../../hooks/useBrazilianBanks", () => ({
  useBrazilianBanks: vi.fn(() => ({
    data: [
      { code: "001", name: "Banco do Brasil" },
      { code: "260", name: "Nubank" },
      { code: "341", name: "Itaú Unibanco" },
    ],
    isLoading: false,
    isSuccess: true,
  })),
}));

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("BankPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBrazilianBanks).mockReturnValue({
      data: [
        { code: "001", name: "Banco do Brasil" },
        { code: "260", name: "Nubank" },
        { code: "341", name: "Itaú Unibanco" },
      ],
      isLoading: false,
      isSuccess: true,
    } as ReturnType<typeof useBrazilianBanks>);
  });

  it("opens list and selects institution code by name search", async () => {
    const onChange = vi.fn();
    renderWithQuery(<BankPicker value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    const search = screen.getByPlaceholderText(/Buscar por nome ou código/i);
    fireEvent.change(search, { target: { value: "Nubank" } });

    fireEvent.click(await screen.findByText(/Nubank \(260\)/i));
    expect(onChange).toHaveBeenCalledWith("260");
  });

  it("filters by FEBRABAN code", async () => {
    const onChange = vi.fn();
    renderWithQuery(<BankPicker value="001" onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome ou código/i), {
      target: { value: "341" },
    });

    expect(await screen.findByText(/Itaú Unibanco \(341\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nubank \(260\)/i)).toBeNull();
  });

  it("shows selected bank label", () => {
    renderWithQuery(<BankPicker value="001" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent(/Banco do Brasil \(001\)/i);
  });

  it("renders empty list safely while banks are still loading", () => {
    vi.mocked(useBrazilianBanks).mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
    } as ReturnType<typeof useBrazilianBanks>);

    renderWithQuery(<BankPicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText(/Nenhum banco encontrado/i)).toBeInTheDocument();
  });
});
