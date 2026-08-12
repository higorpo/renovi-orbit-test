# Dashboard — layout e navegação (`dashboard-shell`)

## 1. Leitura para negócio

- **Para que serve:** envolver todas as rotas sob `/dashboard` com **navegação** (header desktop, bottom nav / chrome mobile), estado offline, slots persistentes de lista e **área de conteúdo** (`<Outlet />`).
- **Quem usa:** clientes e prestadores autenticados (`ProtectedRoute` pai com `allowedRoles={['client','provider']}`; subguards por rota filha quando necessário).
- **Problema que resolve:** experiência consistente do painel após login — menu por papel, deep links e chrome mobile previsíveis.
- **Risco operacional:**
  - Prestador sem KYC `ACTIVE` (ou enquanto a conta carrega): **conteúdo** operacional substituído pelo gate; **menus completamente ocultos** (DesktopNav, bottom nav, hamburger); header/logo permanece; detalhes em [provider-kyc](../provider-kyc/README.md).
- **Não inventar expectativa:** calendário do prestador **não** aparece no menu — entrada via banner em Meus Serviços. **Ganhos** e **Endereços** também **não** são itens do menu; vivem no hub Configurações (`/dashboard/settings/*`).

## 2. Visão geral funcional

O shell (`DashboardLayout`) monta:

1. Menu a partir de `getDashboardMenu(role)` (definição completa do papel).
2. Chrome desktop (logo + `DesktopNav`) ou mobile (`MobileTabHeader` / `MobileStackHeader` / `MobileBottomNav` conforme `resolveMobileChrome`) — nav **omitida** quando `useProviderKycBlocksNav()` é `true`. O mark Prestway no header desktop e no `MobileTabHeader` usa paleta do papel (`resolveAudienceTheme`), não a variante institucional mista (`inst`).
3. Conteúdo: `ProviderKycGate` envolve slots do prestador + outlet; slot de Meus Serviços do **cliente** fica **fora** do gate.
4. Sheet de detalhe de serviço (`ServiceDetailSheet`) quando a navegação usa modal routing.
5. Sem bottom nav: `main` **sem** `pb-20`.

Páginas filhas podem ser **reais** (features) ou **placeholder** (`DashboardFakePage`).

## 3. Features do módulo

| Feature | Documento |
|---------|-----------|
| Layout, menu por papel, rotas reais vs placeholder, gate KYC no shell | [features/placeholders-e-menu.md](./features/placeholders-e-menu.md) |

## 4. Perfis envolvidos

| Perfil | No shell |
|--------|----------|
| `client` | Menu cliente; Configurações → `/dashboard/settings`; sem jobs/calendar; logo azul (`PrestwayIcon` variant `client`) |
| `provider` | Menu prestador quando KYC `ACTIVE`; jobs e calendar (fora do menu); Ganhos no hub Configurações; gate KYC + allowlist `/dashboard/settings*`; chrome oculto se loading/não-`ACTIVE`; logo laranja (variant `provider`) |
| Outros / guest | Bloqueados pelo `ProtectedRoute` pai do dashboard. Sem `profile` / `admin`: `resolveAudienceTheme` cai em paleta cliente (azul), igual a `html[data-audience]` |

## 5. Principais fluxos

1. Usuário autenticado entra em `/dashboard/...` → layout resolve menu, `useProviderKycBlocksNav` e chrome.
2. Prestador loading ou sem `ACTIVE` → chrome de nav oculto; outlet operacional substituído pelas UIs do `ProviderKycGate` (exceto conteúdo em `/dashboard/settings*`).
3. Prestador `ACTIVE` → navegação por item de menu ou deep link → `Outlet` (ou slot/sheet) da feature.
4. Offline → offset do header (`top-11` vs `top-0`) via `useOnlineStatus`.

## 6. Regras transversais

- **Menu ≠ inventário completo de rotas:** existem rotas reais sem item no menu (`/dashboard/services/calendar`, `/dashboard/services/:id`); Ganhos/Endereços ficam sob o hub Configurações, não como itens top-level.
- **Bottom nav mobile:** primeiros N itens de `allItems` (`CLIENT_MAIN_COUNT = 4`, `PROVIDER_MAIN_COUNT = 5`); com essas contagens iguais ao tamanho de `allItems`, não há item extra no overflow — quando o chrome está visível.
- **KYC:** bloqueio de **conteúdo** (gate) + ocultação do **chrome** (`useProviderKycBlocksNav`) e allowlist são do módulo [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md); o shell hospeda gate e consome o hook.
- **Fallback de papel:** se `profile` ainda sem `role`, o layout trata como `"client"` (`profile?.role ?? "client"`).
- **Logo no chrome:** `logoVariant = resolveAudienceTheme(role)` no `PrestwayIcon` (`layout="full"`) do header desktop e do `MobileTabHeader` (prop; default `"client"`). Cliente e fallback (profile null / `admin`) = azul; prestador = laranja. Não usa `variant="inst"`. `html[data-audience]` continua o mesmo mapeamento via `syncAudienceTheme` no `AuthProvider`. O `MobileStackHeader` não exibe o mark.

## 7. Entidades

Nenhuma persistência própria do shell. Lê `profile.role` via `useAuth`. Conta NetCred / `useProviderKycBlocksNav` — domínio de **provider-kyc**.

## 8. Integrações

| Módulo / feature | Como o shell integra |
|------------------|----------------------|
| **auth** | `useAuth`, `ProtectedRoute`, `resolveAudienceTheme` (paleta do logo) |
| **provider-kyc** | `ProviderKycGate` + `useProviderKycBlocksNav` (conteúdo + chrome) |
| **my-services** | `ClientMyServicesPersistentSlot`, `ProviderMyServicesPersistentSlot` |
| **provider-jobs** | `ProviderJobsPersistentSlot` |
| **view-services** | `ServiceDetailSheet`, `useServiceDetailModal` |
| **chats**, **provider-earnings**, **settings**, **provider-calendar** | Páginas lazy no `router.tsx` sob `/dashboard/*` (não importadas pelo layout diretamente, salvo slots acima) |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| Placeholder Visão geral (`/dashboard`) | Confirmado (`DashboardFakePage`) |
| Hub Configurações (`/dashboard/settings/*`) | **Real** — feature `settings`; item no menu |
| Conteúdo futuro de Visão geral | Não localizado no código |
| Rota/menu Ajuda (`/dashboard/help`) | **Removida** (sem redirect); `DashboardFakePage` permanece só no index |
| Itens Endereços / Ganhos / rota `/dashboard/conta` | **Removidos** do menu/router; hub `/dashboard/settings` |
| Item antigo de menu “Orçamentos” (prestador) | **Removido** — não está em `dashboardMenu.ts` atual |

## 10. Evidências

- `src/layouts/DashboardLayout/DashboardLayout.tsx`
- `src/layouts/DashboardLayout/dashboardMenu.ts`
- `src/layouts/DashboardLayout/DashboardFakePage.tsx`
- `src/layouts/DashboardLayout/mobileNavigation.config.ts`
- `src/layouts/DashboardLayout/DesktopNav.tsx`, `MobileBottomNav.tsx`, `MobileTabHeader.tsx` (`hideMenu`, `logoVariant`), `MobileNav.tsx` (repassa `logoVariant`), `MobileStackHeader.tsx`
- `src/features/auth/utils/audienceTheme.ts` (`resolveAudienceTheme`)
- `src/components/brand/PrestwayIcon.tsx`
- `src/features/provider-kyc/` (`ProviderKycGate`, `useProviderKycBlocksNav`, `PROVIDER_KYC_ALLOWED_PATH_PREFIX`)
- `src/router.tsx` (filhos de `path: 'dashboard'`)
- Feature: [placeholders-e-menu.md](./features/placeholders-e-menu.md)
