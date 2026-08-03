# Dashboard — layout e navegação (`dashboard-shell`)

## 1. Leitura para negócio

- **Para que serve:** envolver todas as rotas sob `/dashboard` com **navegação** (header desktop, bottom nav / chrome mobile), estado offline, slots persistentes de lista e **área de conteúdo** (`<Outlet />`).
- **Quem usa:** clientes e prestadores autenticados (`ProtectedRoute` pai com `allowedRoles={['client','provider']}`; subguards por rota filha quando necessário).
- **Problema que resolve:** experiência consistente do painel após login — menu por papel, deep links e chrome mobile previsíveis.
- **Risco operacional:**
  - Item de menu **Endereços** (`/dashboard/addresses`) ainda é **placeholder** (“Página em construção”), embora endereços reais existam em **Minha conta** (`AddressesSection`).
  - Prestador sem KYC `ACTIVE` vê o **conteúdo** operacional substituído pelo gate (wizard/status); o **menu completo** do prestador permanece; detalhes em [provider-kyc](../provider-kyc/README.md).
- **Não inventar expectativa:** calendário do prestador **não** aparece no menu — entrada via banner em Meus Serviços.

## 2. Visão geral funcional

O shell (`DashboardLayout`) monta:

1. Menu a partir de `getDashboardMenu(role)` (completo, sem filtro KYC).
2. Chrome desktop (logo + `DesktopNav`) ou mobile (`MobileTabHeader` / `MobileStackHeader` / `MobileBottomNav` conforme `resolveMobileChrome`).
3. Conteúdo: `ProviderKycGate` envolve slots do prestador + outlet; slot de Meus Serviços do **cliente** fica **fora** do gate.
4. Sheet de detalhe de serviço (`ServiceDetailSheet`) quando a navegação usa modal routing.

Páginas filhas podem ser **reais** (features) ou **placeholder** (`DashboardFakePage`).

## 3. Features do módulo

| Feature | Documento |
|---------|-----------|
| Layout, menu por papel, rotas reais vs placeholder, gate KYC no shell | [features/placeholders-e-menu.md](./features/placeholders-e-menu.md) |

## 4. Perfis envolvidos

| Perfil | No shell |
|--------|----------|
| `client` | Menu cliente; rotas comuns + `/dashboard/addresses` (placeholder); sem jobs/earnings/calendar |
| `provider` | Menu prestador; jobs, earnings, calendar (fora do menu); gate KYC + allowlist `/dashboard/conta*` |
| Outros / guest | Bloqueados pelo `ProtectedRoute` pai do dashboard |

## 5. Principais fluxos

1. Usuário autenticado entra em `/dashboard/...` → layout resolve menu e chrome.
2. Prestador sem `ACTIVE` → menu completo; outlet operacional substituído pelas UIs do `ProviderKycGate` (exceto `/dashboard/conta*`).
3. Navegação por item de menu ou deep link → `Outlet` (ou slot/sheet) da feature correspondente — ou UI KYC se o gate bloquear.
4. Offline → offset do header (`top-11` vs `top-0`) via `useOnlineStatus`.

## 6. Regras transversais

- **Menu ≠ inventário completo de rotas:** existem rotas reais/placeholder sem item no menu (`/dashboard/settings`, `/dashboard/services/calendar`, `/dashboard/services/:id`).
- **Bottom nav mobile:** primeiros **5** itens de `allItems` (`CLIENT_MAIN_COUNT` / `PROVIDER_MAIN_COUNT`); demais ficam no overflow do hamburger / desktop “mais”.
- **KYC:** bloqueio de **conteúdo** e allowlist são responsabilidade do módulo [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md); o shell hospeda o gate e monta o menu completo via `getDashboardMenu(role)`.
- **Fallback de papel:** se `profile` ainda sem `role`, o layout trata como `"client"` (`profile?.role ?? "client"`).

## 7. Entidades

Nenhuma persistência própria do shell. Lê `profile.role` via `useAuth`. O gate KYC lê conta NetCred (`provider_gateway_accounts`) — domínio de **provider-kyc**, não do shell.

## 8. Integrações

| Módulo / feature | Como o shell integra |
|------------------|----------------------|
| **auth** | `useAuth`, `ProtectedRoute` |
| **provider-kyc** | `ProviderKycGate` (bloqueio de conteúdo; menu não filtrado) |
| **my-services** | `ClientMyServicesPersistentSlot`, `ProviderMyServicesPersistentSlot` |
| **provider-jobs** | `ProviderJobsPersistentSlot` |
| **view-services** | `ServiceDetailSheet`, `useServiceDetailModal` |
| **chats**, **provider-earnings**, **my-account**, **provider-calendar** | Páginas lazy no `router.tsx` sob `/dashboard/*` (não importadas pelo layout diretamente, salvo slots acima) |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| `/dashboard/addresses` no menu cliente aponta para placeholder | Confirmado no router |
| `/dashboard/settings` existe como placeholder mas **não** está no menu | Confirmado |
| Conteúdo futuro de Visão geral / Ajuda / Configurações / Endereços (menu) | Não localizado no código |
| Item antigo de menu “Orçamentos” (prestador) | **Removido** — não está em `dashboardMenu.ts` atual |

## 10. Evidências

- `src/layouts/DashboardLayout/DashboardLayout.tsx`
- `src/layouts/DashboardLayout/dashboardMenu.ts`
- `src/layouts/DashboardLayout/DashboardFakePage.tsx`
- `src/layouts/DashboardLayout/mobileNavigation.config.ts`
- `src/layouts/DashboardLayout/DesktopNav.tsx`, `MobileBottomNav.tsx`, `MobileTabHeader.tsx`, `MobileStackHeader.tsx`
- `src/features/provider-kyc/` (`ProviderKycGate`, `PROVIDER_KYC_ALLOWED_PATH_PREFIX`)
- `src/router.tsx` (filhos de `path: 'dashboard'`)
- Feature: [placeholders-e-menu.md](./features/placeholders-e-menu.md)
