import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  createProviderMyServicesServiceDetailState,
  getServiceCoordinates,
  getServiceDetailPath,
  type ServiceModel,
} from "@/features/view-services";
import { openGoogleMaps } from "@/lib/maps/openGoogleMaps";
import { useMyServicesPageCore } from "./useMyServicesPageCore";
import { useProviderServiceProposalDialogs } from "./useProviderServiceProposalDialogs";
import { useProviderMarkExecutedDialog } from "./useProviderMarkExecutedDialog";

export function useProviderMyServicesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const core = useMyServicesPageCore();
  const proposalDialogs = useProviderServiceProposalDialogs();
  const markExecutedDialog = useProviderMarkExecutedDialog();

  const handleOpenDetails = useCallback(
    (model: ServiceModel) => {
      navigate(getServiceDetailPath(model.id), {
        state: createProviderMyServicesServiceDetailState(location),
      });
    },
    [location, navigate],
  );

  const handleOpenChat = useCallback(
    (model: ServiceModel) => {
      const chatId = model.chatSummary?.id;
      if (!chatId) return;
      navigate(`/dashboard/chats/${chatId}`);
    },
    [navigate],
  );

  const handleOpenMap = useCallback((model: ServiceModel) => {
    const coordinates = getServiceCoordinates(model.address);
    if (!coordinates) return;
    openGoogleMaps(coordinates);
  }, []);

  const handleReviseProposal = useCallback(
    (model: ServiceModel) => {
      void proposalDialogs.openReviseProposal(model);
    },
    [proposalDialogs],
  );

  const handleViewProposal = useCallback(
    (model: ServiceModel) => {
      proposalDialogs.openViewProposal(model);
    },
    [proposalDialogs],
  );

  const handleMarkExecuted = useCallback(
    (model: ServiceModel) => {
      markExecutedDialog.openMarkExecuted(model);
    },
    [markExecutedDialog.openMarkExecuted],
  );

  return {
    ...core,
    handleOpenDetails,
    handleOpenChat,
    handleOpenMap,
    handleReviseProposal,
    handleViewProposal,
    handleMarkExecuted,
    proposalDialogs,
    markExecutedDialog,
  };
}
