export type ClearSaleWindow = Window & {
  csdp?: (...args: unknown[]) => void;
};

export type InjectClearSaleSdkOptions = {
  sessionId: string;
  appKey: string;
  documentRef?: Document;
  windowRef?: ClearSaleWindow;
  createScript?: (documentRef: Document) => HTMLScriptElement;
  onInitialized?: () => void;
  onLoadFailed?: () => void;
};

const CLEARSALE_SCRIPT_SRC = "https://device.clearsale.com.br/p/fp.js";

export function injectClearSaleSdk(options: InjectClearSaleSdkOptions): () => void {
  const documentRef = options.documentRef ?? document;
  const windowRef = options.windowRef ?? (window as ClearSaleWindow);
  const createScript = options.createScript ?? ((doc) => doc.createElement("script"));

  const script = createScript(documentRef);
  script.async = true;
  script.src = CLEARSALE_SCRIPT_SRC;

  script.onload = () => {
    windowRef.csdp?.("app", options.appKey);
    windowRef.csdp?.("sessionid", options.sessionId);
    options.onInitialized?.();
  };

  script.onerror = () => {
    options.onLoadFailed?.();
  };

  documentRef.head.appendChild(script);

  return () => {
    script.remove();
  };
}
