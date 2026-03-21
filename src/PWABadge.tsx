import { useRegisterSW } from 'virtual:pwa-register/react'
import { PackageCheck, RefreshCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function PWABadge() {
  const period = 60 * 60 * 1000

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (period <= 0 || !r) return
      if (r.active?.state === 'activated') {
        registerPeriodicSync(period, swUrl, r)
      } else if (r.installing) {
        r.installing.addEventListener('statechange', (e) => {
          const sw = e.target as ServiceWorker
          if (sw.state === 'activated') registerPeriodicSync(period, swUrl, r)
        })
      }
    },
  })

  function close() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  const visible = offlineReady || needRefresh

  return (
    <div
      className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 sm:inset-x-auto sm:justify-end')}
      aria-hidden={!visible}
    >
      {visible && (
        <div
          className="pointer-events-auto w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 sm:max-w-sm"
          role="region"
          aria-labelledby="pwa-badge-title"
          aria-describedby="pwa-badge-desc"
          aria-live="polite"
        >
          <div className="relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
            <button
              type="button"
              onClick={close}
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar aviso"
            >
              <X className="size-4" aria-hidden />
            </button>

            <div className="flex gap-4 p-4 pr-12">
              <div
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full',
                  offlineReady ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                )}
                aria-hidden
              >
                {offlineReady ? (
                  <PackageCheck className="size-6" strokeWidth={1.75} />
                ) : (
                  <RefreshCw className="size-6" strokeWidth={1.75} />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                <h2 id="pwa-badge-title" className="text-base font-semibold leading-tight tracking-tight">
                  {offlineReady ? 'Pronto para usar offline' : 'Nova versão disponível'}
                </h2>
                <p id="pwa-badge-desc" className="text-sm leading-relaxed text-muted-foreground">
                  {offlineReady
                    ? 'Guardamos o essencial no seu aparelho. Você pode usar o app mesmo sem internet.'
                    : 'Temos melhorias e correções para você. Atualize quando quiser — é bem rápido.'}
                </p>

                <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
                  {needRefresh && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => updateServiceWorker(true)}
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      Atualizar agora
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={needRefresh ? 'outline' : 'default'}
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={close}
                  >
                    {needRefresh ? 'Agora não' : 'Entendi, obrigado'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PWABadge

function registerPeriodicSync(
  period: number,
  swUrl: string,
  r: ServiceWorkerRegistration
) {
  if (period <= 0) return

  setInterval(async () => {
    if ('onLine' in navigator && !navigator.onLine) return

    const resp = await fetch(swUrl, {
      cache: 'no-store',
      headers: {
        cache: 'no-store',
        'cache-control': 'no-cache',
      },
    })

    if (resp?.status === 200) await r.update()
  }, period)
}
