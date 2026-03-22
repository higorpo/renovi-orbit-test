import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SortMode } from "../../types/provider-jobs.types";
import { JobsSortTabs } from "../JobsSortTabs";

describe("JobsSortTabs disabled", () => {
  it("notifies parent when another sort tab is activated", () => {
    const onModeChange = vi.fn();
    const Harness: ComponentType = () => {
      const [mode, setMode] = useState<SortMode>("nearest");
      return (
        <JobsSortTabs
          activeMode={mode}
          onModeChange={(next) => {
            setMode(next);
            onModeChange(next);
          }}
        />
      );
    };
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: /mais recentes/i }));
    expect(onModeChange).toHaveBeenCalledWith("newest");
  });

  it("disables triggers when disabled prop is set", () => {
    render(
      <JobsSortTabs
        activeMode="nearest"
        onModeChange={vi.fn()}
        disabled
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.every((t) => t.hasAttribute("disabled") || t.getAttribute("data-disabled") !== null)).toBe(true);
  });
});
