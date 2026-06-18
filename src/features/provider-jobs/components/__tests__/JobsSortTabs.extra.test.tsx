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

  it("notifies parent when least competitive tab is chosen", () => {
    const onModeChange = vi.fn();
    render(<JobsSortTabs activeMode="nearest" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /menos concorridos/i }));
    expect(onModeChange).toHaveBeenCalledWith("least_competitive");
  });

  it("hides nearest tab when feed GPS is unavailable", () => {
    render(<JobsSortTabs activeMode="newest" onModeChange={vi.fn()} hasFeedGps={false} />);
    expect(screen.queryByRole("tab", { name: /mais próximos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /mais recentes/i })).toBeInTheDocument();
  });

  it("shows nearest tab when feed GPS is available", () => {
    render(<JobsSortTabs activeMode="nearest" onModeChange={vi.fn()} hasFeedGps />);
    expect(screen.getByRole("tab", { name: /mais próximos/i })).toBeInTheDocument();
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

  it("marks newest tab as selected when activeMode is newest", () => {
    render(<JobsSortTabs activeMode="newest" onModeChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /mais recentes/i })).toHaveAttribute("aria-selected", "true");
  });

  it("marks least competitive tab as selected when activeMode matches", () => {
    render(<JobsSortTabs activeMode="least_competitive" onModeChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /menos concorridos/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("notifies parent when sort value changes via Tabs keyboard activation", () => {
    const onModeChange = vi.fn();
    render(<JobsSortTabs activeMode="nearest" onModeChange={onModeChange} />);
    const newest = screen.getByRole("tab", { name: /mais recentes/i });
    newest.focus();
    fireEvent.keyDown(newest, { key: "Enter", code: "Enter" });
    fireEvent.click(newest);
    expect(onModeChange).toHaveBeenCalledWith("newest");
  });
});
