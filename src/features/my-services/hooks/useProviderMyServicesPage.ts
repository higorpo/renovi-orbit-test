import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  createProviderMyServicesServiceDetailState,
  getServiceDetailPath,
  type ServiceModel,
} from "@/features/view-services";
import { useMyServicesPageCore } from "./useMyServicesPageCore";

export function useProviderMyServicesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const core = useMyServicesPageCore();

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

  return {
    ...core,
    handleOpenDetails,
    handleOpenChat,
  };
}
