import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Container base - flex horizontal com scroll
      'inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1',
      // Scroll horizontal em mobile - esconde scrollbar
      'overflow-x-auto',
      // Hide scrollbar cross-browser
      '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
      // Altura mínima para touch targets
      'min-h-[40px] sm:min-h-[44px]',
      // Snap scroll para melhor UX mobile
      'snap-x snap-mandatory scroll-smooth',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Layout flex para centralizar
      'inline-flex items-center justify-center',
      // Snap point para scroll
      'snap-start',
      // Dimensões - altura fixa, largura automática, não encolhe
      'h-8 sm:h-9 px-2.5 sm:px-3 md:px-4',
      'flex-shrink-0',
      // Tipografia responsiva
      'text-xs sm:text-sm font-medium',
      // Texto não quebra linha
      'whitespace-nowrap',
      // Aparência base
      'rounded-md text-muted-foreground',
      // Transições
      'transition-all duration-200',
      // Hover
      'hover:bg-background/60 hover:text-foreground',
      // Estado ativo
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      // Focus
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      // Disabled
      'disabled:pointer-events-none disabled:opacity-50',
      // Ring offset
      'ring-offset-background',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-3 sm:mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
