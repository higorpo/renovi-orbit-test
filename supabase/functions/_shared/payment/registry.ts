import { NetCredAdapter, type NetCredAdapterDeps } from "./netcred-adapter.ts";
import type { PaymentProvider } from "./types.ts";

const registry = new Map<string, PaymentProvider>();

export function configureAdapterRegistry(deps: NetCredAdapterDeps): void {
  registry.clear();
  registry.set("netcred", new NetCredAdapter(deps));
}

export const AdapterRegistry = {
  get(slug: string): PaymentProvider {
    const adapter = registry.get(slug);
    if (!adapter) {
      throw new Error(`PAYMENT_ADAPTER_NOT_REGISTERED:${slug}`);
    }
    return adapter;
  },
};
