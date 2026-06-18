export { DeviceBeaconProvider } from './components/DeviceBeaconProvider'
export { ProviderLocationProvider } from './components/ProviderLocationProvider'
export { LocationPermissionDialogHost } from './components/LocationPermissionDialogHost'
export { upsertDeviceBeacon, deleteDeviceBeacon } from './api/deviceBeacon.api'
export { useLocationPermissionDialog } from './hooks/useLocationPermissionDialog'
export { useProviderLocationTracking } from './hooks/useProviderLocationTracking'
export { unregisterDeviceBeaconOnLogout } from './utils/unregisterDeviceBeaconOnLogout'
export {
  stopProviderLocationTracking,
  startProviderLocationTracking,
} from './utils/providerLocationTracking.runtime'
export {
  collectDeviceBeaconPayload,
  buildPayloadFromPushState,
} from './utils/collectDeviceBeaconPayload'
export type { CollectDeviceBeaconContext } from './utils/collectDeviceBeaconPayload'
export {
  getLatestProviderLocationSample,
  subscribeProviderLocationSamples,
} from './utils/locationSync'
export {
  requestOperationalLocationPermission,
  captureOperationalLocationFix,
  getOperationalLocationPermissionStatus,
} from './utils/requestOperationalLocationPermission'
export type { OperationalLocationPermissionStatus } from './utils/requestOperationalLocationPermission'
export {
  getStoredLocationPermissionGranted,
  isLocationPromptSeen,
  LOCATION_PERMISSION_DIALOG_KEY,
  LOCATION_PERMISSION_GRANTED_KEY,
} from './utils/locationPermissionPrompt.storage'
export type { DeviceBeacon, DeviceBeaconUpsertPayload } from './types/deviceBeacon.types'
export {
  DEVICE_BEACON_SYNC_INTERVAL_MS,
  DEVICE_BEACON_SYNC_STORAGE_KEY,
  LOCATION_SYNC_DEBOUNCE_MS,
  LOCATION_DISTANCE_FILTER_METERS,
} from './types/deviceBeacon.types'
