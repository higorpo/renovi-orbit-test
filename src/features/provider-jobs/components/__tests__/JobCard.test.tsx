import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { JobCard } from "../JobCard";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

const navigate = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    color: "from-slate-600 to-slate-800",
    Icon: () => <span data-testid="svc-icon" />,
  }),
}));

function openDismissMenu() {
  const menuTrigger = screen.getByRole("button", { name: /mais opções/i });
  fireEvent.pointerDown(menuTrigger, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.pointerUp(menuTrigger, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.click(menuTrigger);
}

describe("JobCard", () => {
  it("renders job metadata and opens detail from card body", () => {
    navigate.mockClear();
    const job = createMinimalJob({
      title: "Troca de chuveiro",
      urgency: "high",
      service_name: "Hidráulica",
    });
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Troca de chuveiro")).toBeInTheDocument();
    expect(screen.getByText(/urgente/i)).toBeInTheDocument();
    expect(screen.getByText(/hidráulica/i)).toBeInTheDocument();
    expect(screen.queryByText(/conversa/i)).not.toBeInTheDocument();
    const mainButton = screen.getByRole("button", { name: /ver detalhes: troca de chuveiro/i });
    fireEvent.click(mainButton);
    expect(navigate).toHaveBeenCalledWith(
      "/dashboard/services/job-1",
      expect.objectContaining({ state: expect.any(Object) }),
    );
  });

  it("renders description below title when available", () => {
    const job = createMinimalJob({
      description: "Preciso instalar uma tomada na cozinha, perto da bancada.",
    });
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Preciso instalar uma tomada na cozinha, perto da bancada."),
    ).toBeInTheDocument();
  });

  it("hides description when empty", () => {
    const job = createMinimalJob({ description: null });
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/cozinha/i)).not.toBeInTheDocument();
  });

  it("renders footer link to job detail", () => {
    const job = createMinimalJob();
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    const footerLink = screen.getByRole("link", { name: /^ver detalhes$/i });
    expect(footerLink).toHaveAttribute("href", "/dashboard/services/job-1");
  });

  it("opens confirmation dialog before dismissing opportunity", () => {
    const onDismiss = vi.fn();
    const job = createMinimalJob();
    render(
      <MemoryRouter>
        <JobCard job={job} onDismiss={onDismiss} />
      </MemoryRouter>,
    );

    openDismissMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /não tenho interesse/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/ocultar esta oportunidade/i)).toBeInTheDocument();
    expect(
      screen.getByText(/este pedido sairá da sua lista de oportunidades/i),
    ).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses opportunity after confirmation", () => {
    const onDismiss = vi.fn();
    const job = createMinimalJob();
    render(
      <MemoryRouter>
        <JobCard job={job} onDismiss={onDismiss} />
      </MemoryRouter>,
    );

    openDismissMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /não tenho interesse/i }));
    fireEvent.click(screen.getByRole("button", { name: /^não tenho interesse$/i }));

    expect(onDismiss).toHaveBeenCalledWith("job-1");
  });

  it("does not dismiss when keeping opportunity in list", () => {
    const onDismiss = vi.fn();
    const job = createMinimalJob();
    render(
      <MemoryRouter>
        <JobCard job={job} onDismiss={onDismiss} />
      </MemoryRouter>,
    );

    openDismissMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /não tenho interesse/i }));
    fireEvent.click(screen.getByRole("button", { name: /manter na lista/i }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("shows open-market badge for fallback source", () => {
    const job = createMinimalJob({ source: "fallback", urgency: "low" });
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/mercado aberto/i)).toBeInTheDocument();
  });

  it("shows Ocultando label when confirming dismiss while pending", () => {
    const job = createMinimalJob();
    const { rerender } = render(
      <MemoryRouter>
        <JobCard job={job} onDismiss={vi.fn()} isDismissing={false} />
      </MemoryRouter>,
    );

    openDismissMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /não tenho interesse/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <JobCard job={job} onDismiss={vi.fn()} isDismissing />
      </MemoryRouter>,
    );

    expect(screen.getByText(/ocultando/i)).toBeInTheDocument();
  });

  it("hides urgency badge for low urgency without fallback", () => {
    const job = createMinimalJob({ urgency: "low", source: "batch" });
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/urgente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mercado aberto/i)).not.toBeInTheDocument();
  });
});
