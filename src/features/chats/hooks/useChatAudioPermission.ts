import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  canRequestAudioRecordingPermission,
  getAudioRecordingPermissionStatus,
  isAudioRecordingPermissionBlocked,
  requestAudioRecordingPermission,
  waitBeforeSystemPermissionPrompt,
} from "@/lib/capacitor/audioPermission";
import { openAppSettings } from "@/lib/capacitor/openAppSettings";
import { Capacitor } from "@capacitor/core";

const PERMISSION_DENIED_TOAST =
  "Não foi possível gravar áudio. Precisamos de permissão para usar o microfone.";

export function useChatAudioPermission() {
  const [preDialogOpen, setPreDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [recordingSheetOpen, setRecordingSheetOpen] = useState(false);

  const openRecordingSheet = useCallback(() => {
    setRecordingSheetOpen(true);
  }, []);

  const closeRecordingSheet = useCallback(() => {
    setRecordingSheetOpen(false);
  }, []);

  const handlePermissionGranted = useCallback(() => {
    openRecordingSheet();
  }, [openRecordingSheet]);

  const acceptAndRequestPermission = useCallback(async () => {
    setRequesting(true);
    setPreDialogOpen(false);
    await waitBeforeSystemPermissionPrompt();

    try {
      const result = await requestAudioRecordingPermission();
      if (result === "granted") {
        handlePermissionGranted();
        return;
      }

      toast.error(PERMISSION_DENIED_TOAST);
      const latest = await getAudioRecordingPermissionStatus();
      if (isAudioRecordingPermissionBlocked(latest)) {
        setBlockedDialogOpen(true);
      }
    } finally {
      setRequesting(false);
    }
  }, [handlePermissionGranted]);

  const onMicButtonPress = useCallback(async () => {
    const status = await getAudioRecordingPermissionStatus();

    if (status === "granted") {
      openRecordingSheet();
      return;
    }

    if (status === "unsupported") {
      toast.error("Seu dispositivo não suporta gravação de áudio.");
      return;
    }

    if (isAudioRecordingPermissionBlocked(status)) {
      setBlockedDialogOpen(true);
      return;
    }

    if (canRequestAudioRecordingPermission(status)) {
      setPreDialogOpen(true);
    }
  }, [openRecordingSheet]);

  const dismissPreDialog = useCallback(() => {
    setPreDialogOpen(false);
  }, []);

  const dismissBlockedDialog = useCallback(() => {
    setBlockedDialogOpen(false);
  }, []);

  const openSettings = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      const opened = await openAppSettings();
      if (!opened) {
        toast.error("Não foi possível abrir as configurações automaticamente.");
      }
      return;
    }

    toast.message(
      "Abra as configurações do site no navegador e permita o acesso ao microfone.",
    );
  }, []);

  return {
    preDialogOpen,
    blockedDialogOpen,
    requesting,
    recordingSheetOpen,
    setPreDialogOpen,
    setBlockedDialogOpen,
    onMicButtonPress,
    acceptAndRequestPermission,
    dismissPreDialog,
    dismissBlockedDialog,
    openSettings,
    closeRecordingSheet,
  };
}
