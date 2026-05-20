import { useNavigate } from 'react-router'
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import './App.css'
import { useCallback, useEffect, useState } from 'react'
import {
  formatPushNotificationMessage,
  getWebPushPermission,
  setupPushNotifications,
  type PushPlatform,
  type WebPushPermission,
  type PushSetupResult,
} from './lib/push'

function mapPermissionForUi(
  permission: PushSetupResult['permission'],
): WebPushPermission | null {
  if (!permission) return null
  if (permission === 'prompt') return 'default'
  return permission
}
import { isFirebaseConfigured } from './lib/firebase/config'
import { logger } from './lib/logger'

const pushCallbacks = {
  onToken: () => {},
  onForegroundNotification: (payload: Parameters<typeof formatPushNotificationMessage>[0]) => {
    alert(formatPushNotificationMessage(payload))
  },
}

function App() {
  const navigate = useNavigate()

  const [deviceInfo, setDeviceInfo] = useState<string | null>(null)
  const [pushToken, setPushToken] = useState<string | null>(null)
  const [pushPlatform, setPushPlatform] = useState<PushPlatform | null>(null)
  const [pushPermission, setPushPermission] = useState<WebPushPermission | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushEnabling, setPushEnabling] = useState(false)

  const isNative = Capacitor.isNativePlatform()
  const platform = Capacitor.getPlatform()

  const applyPushResult = useCallback(
    (result: Awaited<ReturnType<typeof setupPushNotifications>>) => {
      setPushPlatform(result.platform)
      setPushToken(result.token)
      setPushPermission(mapPermissionForUi(result.permission))
      setPushError(null)
    },
    [],
  )

  const runPushSetup = useCallback(
    async (requestPermission: boolean) => {
      setPushEnabling(true)
      setPushError(null)

      try {
        const result = await setupPushNotifications(
          {
            onToken: (token, pushPlat) => {
              setPushToken(token)
              setPushPlatform(pushPlat)
            },
            onForegroundNotification: pushCallbacks.onForegroundNotification,
          },
          { requestPermission },
        )
        applyPushResult(result)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        setPushError(message)
        setPushPermission(getWebPushPermission())
        logger.warn('push_setup_failed', { message, platform: Capacitor.getPlatform() })
      } finally {
        setPushEnabling(false)
      }
    },
    [applyPushResult],
  )

  useEffect(() => {
    void Device.getInfo().then((info) => setDeviceInfo(JSON.stringify(info)))

    if (isNative) {
      void runPushSetup(true)
      return
    }

    setPushPermission(getWebPushPermission())
    // Web: do not request permission on load — browsers block or deny without a user gesture.
    void runPushSetup(false)
  }, [isNative, runPushSetup])

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8 text-center">
      <h1>Renovi</h1>
      <p>Platform: {platform}</p>
      <p>Info: {deviceInfo}</p>
      {isNative ? <p>Native</p> : <p>Web</p>}
      <p>Push platform: {pushPlatform ?? '—'}</p>
      {!isNative ? <p className="text-sm text-muted-foreground">Permissão: {pushPermission ?? '—'}</p> : null}
      <p className="break-all text-left text-sm">FCM token: {pushToken ?? '—'}</p>

      {!isNative && pushPermission === 'default' ? (
        <div className="my-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            O navegador só mostra o pedido de notificação depois de um clique seu.
          </p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            disabled={pushEnabling}
            onClick={() => void runPushSetup(true)}
          >
            {pushEnabling ? 'Ativando…' : 'Ativar notificações push'}
          </button>
        </div>
      ) : null}

      {!isNative && pushPermission === 'denied' ? (
        <div className="my-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Notificações bloqueadas. No Chrome: ícone de cadeado na barra de endereço → Notificações →
            Permitir → recarregue a página.
          </p>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm"
            disabled={pushEnabling}
            onClick={() => void runPushSetup(true)}
          >
            {pushEnabling ? 'Verificando…' : 'Tentar ativar notificações de novo'}
          </button>
        </div>
      ) : null}

      {pushError ? <p className="text-destructive text-sm">Push: {pushError}</p> : null}

      {!isNative && !isFirebaseConfigured() ? (
        <p className="text-muted-foreground text-sm">
          Web push: configure VITE_FIREBASE_* e VITE_FIREBASE_VAPID_KEY no .env e ative{' '}
          VITE_ENABLE_PWA=true.
        </p>
      ) : null}

      <button onClick={() => navigate('/login')}>Login</button>
    </div>
  )
}

export default App
