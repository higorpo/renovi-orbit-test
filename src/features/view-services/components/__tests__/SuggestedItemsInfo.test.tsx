// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SuggestedItemsInfo } from "../SuggestedItemsInfo";
import { SUGGESTED_ITEMS_TOOLTIP_TEXT } from "../../constants/serviceDetail.constants";

describe("SuggestedItemsInfo", () => {
  it("exposes the suggested items help control and tooltip copy", () => {
    render(<SuggestedItemsInfo ariaLabel="Ajuda equipamentos" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajuda equipamentos" }));
    expect(screen.getByText(SUGGESTED_ITEMS_TOOLTIP_TEXT)).toBeInTheDocument();
  });
});
