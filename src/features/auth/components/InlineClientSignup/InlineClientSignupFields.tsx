import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PASSWORD_REQUIREMENTS } from "../../utils/passwordPolicy";
import { usePasswordFieldDisplay } from "../../hooks/usePasswordFieldDisplay";
import type { ClientSignupIdentityData } from "../../types/clientSignupIdentity.validation";

export interface InlineClientSignupFieldsProps {
  data: ClientSignupIdentityData;
  onDataChange: (
    data: ClientSignupIdentityData | ((prev: ClientSignupIdentityData) => ClientSignupIdentityData)
  ) => void;
  title?: string;
  termsLabel?: string;
}

export function InlineClientSignupFields({
  data,
  onDataChange,
  title = "Seus dados",
  termsLabel = "Li e aceito os termos de uso e política de privacidade.",
}: InlineClientSignupFieldsProps) {
  const {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordDisplay,
  } = usePasswordFieldDisplay({ password: data.password });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-white/90">Nome</Label>
          <Input
            value={data.firstName}
            onChange={(e) => onDataChange((prev) => ({ ...prev, firstName: e.target.value }))}
            placeholder="Nome"
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Sobrenome</Label>
          <Input
            value={data.lastName}
            onChange={(e) => onDataChange((prev) => ({ ...prev, lastName: e.target.value }))}
            placeholder="Sobrenome"
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-white/90">E-mail</Label>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onDataChange((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="seu@email.com"
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-white/90">Senha</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={data.password}
              onChange={(e) => onDataChange((prev) => ({ ...prev, password: e.target.value }))}
              className="bg-white/10 border-white/30 text-white pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 text-white"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", passwordDisplay.colorClass)}
              style={{ width: `${passwordDisplay.widthPercent}%` }}
            />
          </div>
          <p className="text-xs text-white/70 mt-1">{passwordDisplay.label}</p>
          <ul className="text-xs text-white/60 mt-2 space-y-1">
            {PASSWORD_REQUIREMENTS.map((r, i) => (
              <li key={i} className={r.test(data.password) ? "text-green-400" : ""}>
                {r.test(data.password) ? "✓" : "○"} {r.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-white/90">Confirmar senha</Label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={data.confirmPassword}
              onChange={(e) =>
                onDataChange((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
              className="bg-white/10 border-white/30 text-white pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 text-white"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="sm:col-span-2 flex items-start gap-2">
          <Checkbox
            id="terms-inline"
            checked={data.termsAccepted}
            onCheckedChange={(v) =>
              onDataChange((prev) => ({ ...prev, termsAccepted: v === true }))
            }
            className="border-white/30 data-[state=checked]:bg-primary"
          />
          <Label htmlFor="terms-inline" className="text-white/80 text-sm cursor-pointer">
            {termsLabel}
          </Label>
        </div>
      </div>
    </div>
  );
}
