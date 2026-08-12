import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { ProviderReceivablesPage } from "../ProviderReceivablesPage";

describe("ProviderReceivablesPage", () => {
  it("redirects to Ganhos Cobranças", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/settings/receivables"]}>
        <Routes>
          <Route path="/dashboard/settings/receivables" element={<ProviderReceivablesPage />} />
          <Route path="/dashboard/settings/earnings" element={<div>ganhos-hub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("ganhos-hub")).toBeInTheDocument();
  });
});
