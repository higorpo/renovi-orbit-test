import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    if (Capacitor.getPlatform() === "ios") {
      window.open("app-settings:", "_system");
      return true;
    }

    const info = await App.getInfo();
    window.location.href = `intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;scheme=package;package=${info.id};end`;
    return true;
  } catch {
    return false;
  }
}
