# Dashboard — layout e navegação (`dashboard-shell`)

## 1. Leitura para negócio

- **Para que serve:** envolver todas as rotas sob `/dashboard` com **navegação** (header desktop, bottom nav / chrome mobile), estado offline, slots persistentes de lista e **área de conteúdo** (`<Outlet />`).
- **Quem usa:** clientes e prestadores autenticados (`ProtectedRoute` pai com `allowedRoles={['client','provider']}`; subguards por rota filha quando necessário).
- **Problema que resolve:** experiência consistente do painel após login — menu por papel, deep links e chrome mobile previsíveis.
- **Risco operacional:**
  - Prestador sem KYC `ACTIVE` (ou enquanto a conta carrega): **conteúdo** operacional substituído pelo gate; **menus completamente ocultos** (DesktopNav, bottom nav, hamburger); header/logo permanece; detalhes em [provider-kyc](../provider-kyc/README.md).
- **Não inventar expectativa:** calendário do prestador **não** aparece no menu — entrada via banner em Meus Serviços. **Ganhos** e **Endereços** também **não** são itens do menu; vivem no hub Minha conta (`/dashboard/account/*`).

## 2. Visão geral funcional

O shell (`DashboardLayout`) monta:

1. Menu a partir de `getDashboardMenu(role)` (definição completa do papel).
2. Chrome desktop (logo + `DesktopNav`) ou mobile (`MobileTabHeader` / `MobileStackHeader` / `MobileBottomNav` conforme `resolveMobileChrome`) — **omitido** quando `useProviderKycBlocksNav()` é `true`.
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
| `client` | Menu cliente; Minha conta → `/dashboard/account`; sem jobs/calendar |
| `provider` | Menu prestador quando KYC `ACTIVE`; jobs e calendar (fora do menu); Ganhos no hub account; gate KYC + allowlist `/dashboard/account*`; chrome oculto se loading/não-`ACTIVE` |
| Outros / guest | Bloqueados pelo `ProtectedRoute` pai do dashboard |

## 5. Principais fluxos

1. Usuário autenticado entra em `/dashboard/...` → layout resolve menu, `useProviderKycBlocksNav` e chrome.
2. Prestador loading ou sem `ACTIVE` → chrome de nav oculto; outlet operacional substituído pelas UIs do `ProviderKycGate` (exceto conteúdo em `/dashboard/account*`).
3. Prestador `ACTIVE` → navegação por item de menu ou deep link → `Outlet` (ou slot/sheet) da feature.
4. Offline → offset do header (`top-11` vs `top-0`) via `useOnlineStatus`.

## 6. Regras transversais

- **Menu ≠ inventário completo de rotas:** existem rotas reais/placeholder sem item no menu (`/dashboard/settings`, `/dashboard/services/calendar`, `/dashboard/services/:id`).
- **Bottom nav mobile:** primeiros **5** itens de `allItems` (`CLIENT_MAIN_COUNT` / `PROVIDER_MAIN_COUNT`); demais ficam no overflow do hamburger / desktop “mais” — quando o chrome está visível.
- **KYC:** bloqueio de **conteúdo** (gate) + ocultação do **chrome** (`useProviderKycBlocksNav`) e allowlist são do módulo [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md); o shell hospeda gate e consome o hook.
- **Fallback de papel:** se `profile` ainda sem `role`, o layout trata como `"client"` (`profile?.role ?? "client"`).

## 7. Entidades

Nenhuma persistência própria do shell. Lê `profile.role` via `useAuth`. Conta NetCred / `useProviderKycBlocksNav` — domínio de **provider-kyc**.

## 8. Integrações

| Módulo / feature | Como o shell integra |
|------------------|----------------------|
| **auth** | `useAuth`, `ProtectedRoute` |
| **provider-kyc** | `ProviderKycGate` + `useProviderKycBlocksNav` (conteúdo + chrome) |
| **my-services** | `ClientMyServicesPersistentSlot`, `ProviderMyServicesPersistentSlot` |
| **provider-jobs** | `ProviderJobsPersistentSlot` |
| **view-services** | `ServiceDetailSheet`, `useServiceDetailModal` |
| **chats**, **provider-earnings**, **my-account**, **provider-calendar** | Páginas lazy no `router.tsx` sob `/dashboard/*` (não importadas pelo layout diretamente, salvo slots acima) |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| `/dashboard/settings` existe como placeholder mas **não** está no menu | Confirmado |
| Conteúdo futuro de Visão geral / Ajuda / Configurações | Não localizado no código |
| Itens Endereços / Ganhos / rota `/dashboard/conta` | **Removidos** do menu/router; hub `/dashboard/account` |
| Item antigo de menu “Orçamentos” (prestador) | **Removido** — não está em `dashboardMenu.ts` atual |

## 10. Evidências

- `src/layouts/DashboardLayout/DashboardLayout.tsx`
- `src/layouts/DashboardLayout/dashboardMenu.ts`
- `src/layouts/DashboardLayout/DashboardFakePage.tsx`
- `src/layouts/DashboardLayout/mobileNavigation.config.ts`
- `src/layouts/DashboardLayout/DesktopNav.tsx`, `MobileBottomNav.tsx`, `MobileTabHeader.tsx` (`hideMenu`), `MobileStackHeader.tsx`
- `src/features/provider-kyc/` (`ProviderKycGate`, `useProviderKycBlocksNav`, `PROVIDER_KYC_ALLOWED_PATH_PREFIX`)
- `src/router.tsx` (filhos de `path: 'dashboard'`)
- Feature: [placeholders-e-menu.md](./features/placeholders-e-menu.md)
