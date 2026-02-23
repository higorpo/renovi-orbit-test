import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Switch Component - Padrão Global Renovi
 * * Estilo: Comprimido Horizontal (Achatado)
 * Cor Ativo: Verde (#22c55e)
 * Comportamento: Bolinha percorre da extremidade esquerda à direita
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // h-5 (20px) e w-10 (40px) garante o formato de comprimido (dobro da largura)
      // rounded-full cria as cabeças arredondadas do comprimido
      "peer inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      // Cores de estado
      "data-[state=checked]:bg-[#22c55e] data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // h-4 e w-4 (16px) para caber dentro do fundo de 20px (h-5) com respiro perfeito
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
        // data-[state=checked]:translate-x-5 move a bolinha totalmente para a DIREITA
        // data-[state=unchecked]:translate-x-0 mantém a bolinha totalmente na ESQUERDA
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };