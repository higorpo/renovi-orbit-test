// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalRevisionCounter } from "../ProposalRevisionCounter";

describe("ProposalRevisionCounter", () => {
  it("shows remaining revisions", () => {
    render(<ProposalRevisionCounter revisionCount={1} />);
    expect(screen.getByText(/Revisões solicitadas/i)).toBeTruthy();
    expect(screen.getByText(/ainda pode solicitar 1 revisão/i)).toBeTruthy();
  });

  it("pluralizes remaining revisions", () => {
    render(<ProposalRevisionCounter revisionCount={0} />);
    expect(screen.getByText(/ainda pode solicitar 2 revisões/i)).toBeTruthy();
  });

  it("shows limit reached message", () => {
    render(<ProposalRevisionCounter revisionCount={2} />);
    expect(screen.getByText(/Limite de revisões atingido/i)).toBeTruthy();
  });
});
