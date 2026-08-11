# Permissão de push (`push-permission`)

## 1. Leitura para negócio

- **Para que serve:** pedir ao usuário autenticado, de forma **explicativa e consentida**, que ative notificações push no aparelho ou navegador — **antes** do diálogo nativo/sistema — para que a Prestway possa avisá-lo de eventos importantes (orçamentos, pedidos, propostas, atualizações).
- **Quem usa:** qualquer usuário **autenticado** com sessão carregada (cliente, prestador e demais papéis de `ProfileRole`); o texto do dialog varia por papel (`client` / `provider` / fallback).
- **Processo suportado:** onboarding soft de permissão de notificação; não envia mensagens nem gerencia templates.
- **Valor:** aumenta a chance de o usuário conceder permissão no momento certo (gesto explícito “Continuar”), em vez de o navegador/OS bloquear pedido automático.
- **Riscos operacionais:** se o usuário negar no sistema ou dispensar o soft prompt, o app **não** insiste até o fim do cooldown (7 dias); o envio real de push depende de token FCM no beacon e do Message Dispatcher (fora deste módulo).

## 2. Visão geral funcional

- **Objetivo:** exibir um dialog in-app (“Ative as notificações”) quando a permissão do sistema ainda está **pendente** (`default` / `prompt`), e, se o usuário aceitar, chamar `setupPushNotifications` com `requestPermission: true`.
- **Escopo:** apenas front-end (`src/features/push-permission/`) + consumo de libs (`@/lib/push`, Preferences, sequência com localização do prestador).
- **Limites:** não registra clique/engagement; não ingest de dispatch; não UI de configurações de notificação no app; não força re-pedido se o OS já marcou `denied`.
- **Relação com outros módulos:** montado no `RootLayout` junto a `DeviceBeaconProvider` (registro de token sem pedir permissão) e, indiretamente, ao pipeline de entrega (`message-dispatcher` + `notifications` para clique). Na fila de overlays do app open, o soft prompt de push vem **depois** da localização (prestador) e **antes** do prompt de avaliação pendente (`service-completion`).

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Prompt explicativo e cooldown | Dialog soft, disparo no root autenticado, cooldown de 7 dias, integração Capacitor/PWA via `@/lib/push` | [features/prompt-e-cooldown.md](./features/prompt-e-cooldown.md) |

## 4. Perfis envolvidos

| Papel | Comportamento neste módulo |
|-------|----------------------------|
| Cliente (`client`) | Soft prompt com copy de orçamentos / respostas / atualizações de pedido |
| Prestador (`provider`) | Soft prompt **após** a sequência de permissão de localização (`waitForProviderLocationPermissionFlow`); copy de oportunidades / propostas / serviço em andamento |
| Admin / outros / role nulo | Soft prompt com copy genérica (fallback); mesma lógica de permissão e cooldown |
| Visitante (não autenticado) | Dialog **não** abre (`!user?.id`) |

## 5. Principais fluxos do módulo

- **Entrada:** `RootLayout` monta `PushPermissionPromptHost` sob `AuthProvider` + `DeviceBeaconProvider`.
- **Processamento:** após delay de 600 ms (sessão pronta), avalia status de permissão; se pendente e fora do cooldown, abre dialog; “Continuar” fecha o dialog, espera 320 ms e solicita permissão do sistema.
- **Saída:** permissão `granted` → limpa flag de dismiss; `denied` / erro / “Agora não” → grava timestamp de dismiss (cooldown 7 dias).
- **Dependências:** `auth` (usuário/perfil), `@/lib/push`, Preferences (`orbit_push_permission_prompt_dismissed_at`), sequência de localização do prestador (`device-beacon` / `appOpenOverlaySequence`).

## 6. Regras de negócio transversais

1. Soft prompt só se permissão estiver **pendente** (`default` ou `prompt`).
2. Dispensar (“Agora não”, fechar, negar no OS ou falha) ativa **cooldown de 7 dias** via Preferences.
3. Se já `granted`, limpa o timestamp de dismiss e **não** abre o dialog.
4. Prestador: não avalia/abre push enquanto o fluxo de localização (quando iniciado) não concluir.
5. Pedido de permissão do sistema ocorre **somente** após gesto “Continuar” (`requestPermission: true`); o beacon sincroniza push com `requestPermission: false`.
6. Ao concluir a avaliação do soft prompt (abriu e fechou, ou decidiu não abrir), marca `markPushPermissionPromptFlowComplete` para liberar o próximo overlay (prompt de avaliação pendente).

## 7. Entidades e dados relevantes

- **Sem tabela própria** no Supabase.
- **Preferência local:** chave `orbit_push_permission_prompt_dismissed_at` (ISO timestamp) em Capacitor Preferences.
- **Estado de permissão do OS/navegador:** lido via `getPushPermissionStatus` (nativo: Local Notifications no Android / Push Notifications no iOS; web: `Notification.permission` + Firebase configurado).

## 8. Integrações relacionadas

| Integração | Papel |
|------------|--------|
| `@/lib/push` (`setupPushNotifications`, `getPushPermissionStatus`) | Leitura de status e pedido de permissão + registro FCM/web |
| Capacitor Push / Local Notifications | Superfície nativa Android/iOS |
| Firebase Messaging + Service Worker | Push web/PWA |
| `DeviceBeaconProvider` | Setup silencioso de push e sync de token no beacon |
| Message Dispatcher / `notifications` | **Fora do escopo de código deste módulo** — entrega e clique (ver lacunas) |
| `service-completion` (`PendingEvaluationPromptHost`) | Consome a conclusão do fluxo de push via `waitForPushPermissionPromptFlow` — avaliação só abre depois |

## 9. Riscos, lacunas e observações

- **Lacuna de ligação documental/produto:** este módulo **não** importa `message-dispatcher` nem `notifications`; a cadeia “permissão → token no beacon → FCM → clique” atravessa outros módulos (ver feature e pendências).
- Cooldown é só no **soft prompt** in-app; se o usuário negar no OS (`denied`), o dialog **não** reabre mesmo após 7 dias (status deixa de ser pendente).
- Sem tracking GA dedicado neste módulo (diferente do prompt de localização do prestador).

## 10. Evidências no código

- `src/features/push-permission/` (components, hooks, utils, testes)
- `src/layouts/RootLayout.tsx` (`PushPermissionPromptHost`)
- `src/lib/push.ts`, `src/lib/nativeNotificationPermission.ts`
- `src/lib/appOpenOverlaySequence.ts`
- `src/features/device-beacon/components/DeviceBeaconProvider.tsx` (setup com `requestPermission: false`)
- `src/features/device-beacon/hooks/useLocationPermissionDialog.ts` (marca início/fim da sequência de localização)
