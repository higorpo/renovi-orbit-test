import { useCallback, useEffect, useState } from "react";
import type { RescheduleCardCtaId } from "../utils/rescheduleCardCopy";

export function useChatRescheduleDialogs(chatId: string | null) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  useEffect(() => {
    setRequestOpen(false);
    setProposeOpen(false);
    setAcceptOpen(false);
    setAdjustmentOpen(false);
    setCancelOpen(false);
    setActiveRequestId(null);
  }, [chatId]);

  const handleRescheduleAction = useCallback((action: RescheduleCardCtaId, requestId: string) => {
    setActiveRequestId(requestId);

    if (action === "propose") {
      setProposeOpen(true);
      return;
    }

    if (action === "accept") {
      setAcceptOpen(true);
      return;
    }

    if (action === "request_adjustment") {
      setAdjustmentOpen(true);
      return;
    }

    if (action === "cancel") {
      setCancelOpen(true);
    }
  }, []);

  const openProposeDialog = useCallback((requestId: string) => {
    setActiveRequestId(requestId);
    setProposeOpen(true);
  }, []);

  const openAcceptDialog = useCallback((requestId: string) => {
    setActiveRequestId(requestId);
    setAcceptOpen(true);
  }, []);

  return {
    requestOpen,
    setRequestOpen,
    proposeOpen,
    setProposeOpen,
    acceptOpen,
    setAcceptOpen,
    adjustmentOpen,
    setAdjustmentOpen,
    cancelOpen,
    setCancelOpen,
    activeRequestId,
    setActiveRequestId,
    handleRescheduleAction,
    openProposeDialog,
    openAcceptDialog,
  };
}
