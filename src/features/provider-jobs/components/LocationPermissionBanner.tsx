import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LocationPermissionBannerProps {
  permissionDenied: boolean;
  /** True when the page is not a secure context (e.g. http://LAN-IP) — geolocation is blocked by the browser. */
  insecureContext?: boolean;
  /** Capacitor native app — copy targets OS app settings, not browser site permissions. */
  isNativeApp?: boolean;
  onRetry: () => void;
}

export function LocationPermissionBanner({
  permissionDenied,
  insecureContext = false,
  isNativeApp = false,
  onRetry,
}: LocationPermissionBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="flex-1">
        {insecureContext ? (
          <>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Conexão sem HTTPS
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Navegadores só liberam localização em sites HTTPS (ou em{" "}
              <span className="whitespace-nowrap">localhost</span> no computador). Se você abre o app pelo IP da
              rede (ex.: <span className="font-mono text-xs">http://192.168…</span>), use HTTPS ou um túnel
              (ngrok, etc.) ou teste no ambiente publicado.
            </p>
          </>
        ) : permissionDenied ? (
          <>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {isNativeApp ? "Localização bloqueada no app" : "Localização bloqueada no navegador"}
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              {isNativeApp ? (
                <>
                  Permita localização para a Renovi em{" "}
                  <strong className="font-medium">Configurações do dispositivo</strong> (Apps → Renovi →
                  Localização → “Permitir o tempo todo” ou “Permitir apenas enquanto estiver em uso”).
                </>
              ) : (
                <>
                  O sistema pode estar liberado, mas este site precisa de permissão no{" "}
                  <strong className="font-medium">próprio navegador</strong>. No Chrome/Android: toque no cadeado ou
                  em “Configurações do site” e permita localização para este endereço. No Safari (iOS): Ajustes →
                  Safari → Localização, ou limpe dados do site e abra de novo para ver o aviso de permissão.
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Usando localização aproximada
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Não foi possível obter sua localização exata. A lista usa ordenação
              por recência; permitir localização habilita a opção &quot;Mais próximos&quot;.
            </p>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="mt-1.5 h-7 gap-1 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 -ml-[12px] hover:bg-transparent"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
