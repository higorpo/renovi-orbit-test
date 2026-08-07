import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  SERVICE_DETAIL_QUERY_KEY,
  SERVICES_LIST_QUERY_KEY,
  type ServiceModel,
} from "@/features/view-services";

export function useProviderMarkExecutedDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<ServiceModel | null>(null);

  const openMarkExecuted = useCallback((next: ServiceModel) => {
    setModel(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setModel(null);
    }
  }, []);

  // Invalidate while the sheet stays open on the success step; dismiss is owned by the sheet.
  const handleExecuted = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SERVICE_DETAIL_QUERY_KEY });
  }, [queryClient]);

  return {
    open,
    model,
    openMarkExecuted,
    handleOpenChange,
    handleExecuted,
  };
}
