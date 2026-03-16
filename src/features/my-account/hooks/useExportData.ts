import { useState } from "react";
import { toast } from "sonner";

/**
 * Placeholder for data export. When backend supports it, call the API here.
 */
export function useExportData() {
  const [isExporting, setIsExporting] = useState(false);

  const requestExport = async () => {
    setIsExporting(true);
    try {
      // TODO: integrate with backend export endpoint when available
      await new Promise((r) => setTimeout(r, 1500));
      toast.success("Solicitação de exportação registrada. Você receberá um e-mail quando estiver pronta.");
    } catch {
      toast.error("Não foi possível solicitar a exportação.");
    } finally {
      setIsExporting(false);
    }
  };

  return { requestExport, isExporting };
}
