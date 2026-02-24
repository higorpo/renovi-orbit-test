import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignInFormData } from "../../types/login.validation";

const INPUT_CLASS =
  "bg-white/10 border-white/30 text-white placeholder:text-white/50 h-12 focus:border-[#C57A3A] focus:ring-[#C57A3A]/20";
const INPUT_ERROR_CLASS = "border-red-400";
const ERROR_MESSAGE_CLASS =
  "text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2";

export interface LoginFormProps {
  formData: SignInFormData;
  setFormData: React.Dispatch<React.SetStateAction<SignInFormData>>;
  errors: Record<string, string>;
  submitting: boolean;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginForm({
  formData,
  setFormData,
  errors,
  submitting,
  showPassword,
  setShowPassword,
  rememberMe,
  setRememberMe,
  onSubmit,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/90 font-medium">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          className={cn(INPUT_CLASS, errors.email && INPUT_ERROR_CLASS)}
        />
        {errors.email && (
          <p className={ERROR_MESSAGE_CLASS}>{errors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-white/90 font-medium">
          Senha
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Sua senha"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            className={cn(
              INPUT_CLASS,
              "pr-12",
              errors.password && INPUT_ERROR_CLASS
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className={ERROR_MESSAGE_CLASS}>{errors.password}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
            className="border-white/40 data-[state=checked]:bg-[#C57A3A] data-[state=checked]:border-[#C57A3A]"
          />
          <label
            htmlFor="remember-me"
            className="text-sm text-white/70 cursor-pointer select-none hover:text-white/90 transition-colors"
            title="Se desmarcado, você sairá ao fechar o navegador"
          >
            Manter conectado
          </label>
        </div>
        <Link
          to="/esqueceu-senha"
          className="text-sm text-white/70 hover:text-[#C57A3A] transition-colors font-medium"
        >
          Esqueceu a senha?
        </Link>
      </div>

      <Button
        type="submit"
        className="w-full h-12 md:h-14 text-base md:text-lg font-semibold bg-[#C57A3A] hover:bg-[#C57A3A]/90 text-white shadow-lg shadow-[#C57A3A]/30"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar na minha conta"
        )}
      </Button>
    </form>
  );
}
