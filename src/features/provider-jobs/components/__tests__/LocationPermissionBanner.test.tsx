import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocationPermissionBanner } from "../LocationPermissionBanner";

describe("LocationPermissionBanner", () => {
  it("explains insecure HTTP context when geolocation is blocked", () => {
    render(
      <LocationPermissionBanner
        permissionDenied={false}
        insecureContext
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Conexão sem HTTPS")).toBeInTheDocument();
    expect(screen.getByText(/só liberam localização em sites HTTPS/i)).toBeInTheDocument();
  });

  it("shows native app settings copy when permission is denied on device", () => {
    render(
      <LocationPermissionBanner
        permissionDenied
        isNativeApp
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Localização bloqueada no app")).toBeInTheDocument();
    expect(screen.getByText(/Configurações do dispositivo/i)).toBeInTheDocument();
  });

  it("shows browser permission copy when permission is denied on web", () => {
    render(
      <LocationPermissionBanner permissionDenied onRetry={vi.fn()} />,
    );

    expect(screen.getByText("Localização bloqueada no navegador")).toBeInTheDocument();
    expect(screen.getByText(/próprio navegador/i)).toBeInTheDocument();
  });

  it("shows approximate location fallback and retries on click", () => {
    const onRetry = vi.fn();
    render(
      <LocationPermissionBanner permissionDenied={false} onRetry={onRetry} />,
    );

    expect(screen.getByText("Usando localização aproximada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
