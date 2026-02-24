import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Shield,
  Wallet,
  Check,
  X,
  Mail,
  Inbox,
  Link2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPasswordStrengthLabel,
  PASSWORD_REQUIREMENTS,
} from "@/lib/passwordPolicy";
import type { ProviderSignupFormData } from "./validation";
import { STEPS } from "./useProviderSignupForm";

const INPUT_CLASS =
  "bg-white/10 border-white/30 text-white placeholder:text-white/50 h-12 focus:border-[#C57A3A]";
const INPUT_ERROR_CLASS = "border-red-400";
const ERROR_MESSAGE_CLASS = "text-sm text-red-400";

const BASE_URL = (import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "");

const CONFIRM_STEPS = [
  {
    icon: Mail,
    title: "Acesse sua caixa de entrada",
    description: "Abra o email que você utilizou no cadastro.",
  },
  {
    icon: Inbox,
    title: "Procure o email da Renovi",
    description:
      'Assunto algo como "Confirme seu email" ou "Confirmar cadastro".',
  },
  {
    icon: Link2,
    title: "Clique no link de confirmação",
    description: "Um único clique confirma sua conta e libera o login.",
  },
] as const;

export interface ProviderSignupFormProps {
  currentStep: number;
  formData: ProviderSignupFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProviderSignupFormData>>;
  errors: Record<string, string>;
  submitting: boolean;
  signupSuccess?: boolean;
  registeredEmail?: string;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;
  passwordStrength: number;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onGoogleSignup: () => void;
}

export function ProviderSignupForm({
  currentStep,
  formData,
  setFormData,
  errors,
  submitting,
  signupSuccess = false,
  registeredEmail = "",
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordStrength,
  onNext,
  onBack,
  onSubmit,
  onGoogleSignup: _onGoogleSignup,
}: ProviderSignupFormProps) {
  if (signupSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C57A3A]/20">
            <CheckCircle2 className="h-8 w-8 text-[#C57A3A]" aria-hidden />
          </div>
          <h2 className="text-xl font-semibold text-white">
            Cadastro realizado com sucesso!
          </h2>
          <p className="mt-2 text-sm text-white/80">
            Enviamos um link de confirmação para{" "}
            <span className="font-medium text-white">{registeredEmail}</span>.
            Confirme sua conta para fazer login e usar a plataforma.
          </p>
        </div>

        <div className="rounded-xl bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/90">
            Como confirmar sua conta
          </h3>
          <ol className="space-y-4">
            {CONFIRM_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <li key={idx} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C57A3A]/20 text-[#C57A3A]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {idx + 1}. {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/70">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <div>
            <p className="text-sm font-medium text-amber-200">
              Não encontrou o email?
            </p>
            <p className="mt-1 text-xs text-white/80">
              Verifique a pasta de <strong>spam</strong> ou{" "}
              <strong>lixo eletrônico</strong>. O email pode levar alguns minutos
              para chegar. Se ainda não aparecer, entre em contato conosco.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Progress steps - same as ClientSignup */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((_, idx) => (
          <div key={idx} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                idx < currentStep && "bg-[#C57A3A] text-white",
                idx === currentStep && "bg-white text-[#0F2F3A]",
                idx > currentStep && "bg-white/20 text-white/50"
              )}
            >
              {idx < currentStep ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                idx + 1
              )}
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 md:w-12 h-1 mx-1 rounded",
                  idx < currentStep ? "bg-[#C57A3A]" : "bg-white/20"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0: Basic info */}
        {currentStep === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white/90 font-medium">
                Nome Completo *
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
                className={cn(INPUT_CLASS, errors.fullName && INPUT_ERROR_CLASS)}
              />
              {errors.fullName && (
                <p className={ERROR_MESSAGE_CLASS}>{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90 font-medium">
                Email *
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

            {/* <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/30 to-white/30" />
              <span className="text-sm text-white/70 font-medium whitespace-nowrap">
                Ou cadastre-se com
              </span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/30 to-white/30" />
            </div>

            <Button
              type="button"
              onClick={_onGoogleSignup}
              disabled={submitting}
              variant="outline"
              className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border-white/30 font-semibold"
            >
              <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar com Google
            </Button> */}

            <Button
              type="button"
              onClick={onNext}
              className="w-full h-12 bg-[#C57A3A] hover:bg-[#C57A3A]/90 text-white font-semibold !mt-8"
            >
              Continuar
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        )}

        {/* Step 1: Password */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90 font-medium">
                Senha *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 10 caracteres"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          "h-1 flex-1 rounded",
                          passwordStrength >= level
                            ? passwordStrength >= 4
                              ? "bg-green-500"
                              : passwordStrength >= 2
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            : "bg-white/20"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-white/50">
                    {getPasswordStrengthLabel(passwordStrength)}
                  </p>
                </div>
              )}
              <div className="space-y-1 mt-2">
                {PASSWORD_REQUIREMENTS.map((req, idx) => {
                  const passed = formData.password
                    ? req.test(formData.password)
                    : false;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs"
                    >
                      {passed ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-white/30" />
                      )}
                      <span
                        className={
                          passed ? "text-green-400" : "text-white/50"
                        }
                      >
                        {req.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {errors.password && (
                <p className={ERROR_MESSAGE_CLASS}>{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-white/90 font-medium"
              >
                Confirmar Senha *
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Digite a senha novamente"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className={cn(
                    INPUT_CLASS,
                    "pr-12",
                    errors.confirmPassword && INPUT_ERROR_CLASS
                  )}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  aria-label={
                    showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className={ERROR_MESSAGE_CLASS}>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onBack}
                variant="outline"
                className="flex-1 h-12 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={onNext}
                className="flex-1 h-12 bg-[#C57A3A] hover:bg-[#C57A3A]/90 text-white font-semibold"
              >
                Continuar
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Confirmation */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-white">
                Como profissional você terá:
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <TrendingUp className="h-4 w-4 text-[#C57A3A]" />
                  <span>Clientes qualificados na sua região</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Wallet className="h-4 w-4 text-[#C57A3A]" />
                  <span>Pagamento garantido via Escrow</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Shield className="h-4 w-4 text-[#C57A3A]" />
                  <span>Selo de verificação exclusivo</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-white/60 text-sm">Nome</p>
              <p className="text-white font-medium">{formData.fullName}</p>
              <p className="text-white/60 text-sm mt-3">Email</p>
              <p className="text-white font-medium">{formData.email}</p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="terms"
                checked={formData.termsAccepted}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    termsAccepted: checked === true,
                  }))
                }
                className="mt-1 border-white/30 data-[state=checked]:bg-[#C57A3A] data-[state=checked]:border-[#C57A3A]"
              />
              <label
                htmlFor="terms"
                className="text-sm text-white/70 cursor-pointer"
              >
                Li e aceito os{" "}
                <a
                  href={`${BASE_URL}/juridico/termos-de-uso`}
                  className="text-[#C57A3A] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Termos de Uso
                </a>
                ,{" "}
                <a
                  href={`${BASE_URL}/juridico/adesao-prestador`}
                  className="text-[#C57A3A] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contrato de Adesão
                </a>{" "}
                e a{" "}
                <a
                  href={`${BASE_URL}/juridico/comissao-prestador`}
                  className="text-[#C57A3A] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Política de Comissões
                </a>
              </label>
            </div>
            {errors.termsAccepted && (
              <p className={ERROR_MESSAGE_CLASS}>{errors.termsAccepted}</p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onBack}
                variant="outline"
                className="flex-1 h-12 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={onSubmit}
                disabled={submitting || !formData.termsAccepted}
                className="flex-1 h-12 bg-[#C57A3A] hover:bg-[#C57A3A]/90 text-white font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar minha conta"
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
