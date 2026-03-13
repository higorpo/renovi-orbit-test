import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { listServicesForRequestQuote } from "../api/services.api";
import type { ServiceWithChildren } from "../types/request-quote.types";

export interface UseRequestQuoteServicesParams {
  urlServiceSlug: string | null;
  loadingSession: boolean;
  onServiceSelect: (service: ServiceWithChildren) => void;
}

export interface UseRequestQuoteServicesResult {
  services: ServiceWithChildren[];
  isLoading: boolean;
  error: string | null;
}

export function useRequestQuoteServices({
  urlServiceSlug,
  loadingSession,
  onServiceSelect,
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
    if (servicesData?.error) {
      logger.warn("request_quote_services_load_failed", {
        error: servicesData.error,
      });
    }
  }, [servicesData?.error]);

  useEffect(() => {
    if (loadingSession || !urlServiceSlug || services.length === 0) return;
    const found = services
      .flatMap((s) => (s.children ? [s, ...s.children] : [s]))
      .find((s) => s.slug === urlServiceSlug);
    if (found) onServiceSelect(found);
  }, [urlServiceSlug, services, loadingSession, onServiceSelect]);

  return {
    services,
    isLoading,
    error: servicesData?.error ?? null,
  };
}
