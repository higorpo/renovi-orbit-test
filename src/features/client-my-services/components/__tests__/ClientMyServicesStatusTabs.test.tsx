import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "@/components/ui/tabs";
import { ClientMyServicesStatusTabs } from "../ClientMyServicesStatusTabs";

describe("ClientMyServicesStatusTabs", () => {
  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(
      <Tabs value="all">
        <ClientMyServicesStatusTabs
          activeTabId="all"
          onTabChange={onTabChange}
        />
      </Tabs>
    );

    fireEvent.click(screen.getByRole("tab", { name: /Em andamento/i }));
    expect(onTabChange).toHaveBeenCalledWith("in_progress");
  });

  it("marks active tab with aria-selected", () => {
    render(
      <Tabs value="in_progress">
        <ClientMyServicesStatusTabs
          activeTabId="in_progress"
          onTabChange={vi.fn()}
        />
      </Tabs>
    );

    const active = screen.getByRole("tab", { name: /Em andamento/i });
    expect(active).toHaveAttribute("aria-selected", "true");
  });
});
