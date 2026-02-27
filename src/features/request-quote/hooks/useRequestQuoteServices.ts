import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listServicesForRequestQuote } from "../api/services.api";
import type { ServiceWithChildren } from "../types/request-quote.types";

export interface UseRequestQuoteServicesParams {
  urlServiceSlug: string | null;
  loadingSession: boolean;
  setSelectedService: (service: ServiceWithChildren | null) => void;
}

export interface UseRequestQuoteServicesResult {
  services: ServiceWithChildren[];
  isLoading: boolean;
  error: string | null;
}

export function useRequestQuoteServices({
  urlServiceSlug,
  loadingSession,
  setSelectedService,
}: UseRequestQuoteServicesParams): UseRequestQuoteServicesResult {
  const { data: servicesData, isLoading } = useQuery({
    queryKey: ["request-quote-services"],
    queryFn: () => listServicesForRequestQuote(),
  });

  const services = useMemo(
    () => servicesData?.services ?? [],
    [servicesData?.services]
  );

  useEffect(() => {
    if (loadingSession || !urlServiceSlug || services.length === 0) return;
    const found = services
      .flatMap((s) => (s.children ? [s, ...s.children] : [s]))
      .find((s) => s.slug === urlServiceSlug);
    if (found) setSelectedService(found);
  }, [urlServiceSlug, services, loadingSession, setSelectedService]);

  return {
    services,
    isLoading,
    error: servicesData?.error ?? null,
  };
}
