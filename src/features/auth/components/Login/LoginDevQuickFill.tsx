import { Button } from "@/components/ui/button";
import type { SignInFormData } from "../../types/login.validation";

const DEV_PASSWORD = "Abc123";

const DEV_ACCOUNTS = {
  client: { email: "cliente@prestway.com", password: DEV_PASSWORD },
  provider: { email: "prestador@prestway.com", password: DEV_PASSWORD },
} as const;

export interface LoginDevQuickFillProps {
  setFormData: React.Dispatch<React.SetStateAction<SignInFormData>>;
}

export function LoginDevQuickFill({ setFormData }: LoginDevQuickFillProps) {
  const fill = (email: string, password: string) => {
    setFormData({ email, password });
  };

  return (
    <div
      className="space-y-2 rounded-lg border border-dashed border-amber-400/40 bg-amber-500/10 p-3"
      data-testid="login-dev-quick-fill"
    >
      <p className="text-center text-xs text-amber-200/80">Dev: preencher credenciais</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white text-sm"
          onClick={() => fill(DEV_ACCOUNTS.client.email, DEV_ACCOUNTS.client.password)}
        >
          Cliente
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white text-sm"
          onClick={() =>
            fill(DEV_ACCOUNTS.provider.email, DEV_ACCOUNTS.provider.password)
          }
        >
          Prestador
        </Button>
      </div>
    </div>
  );
}
