# Dashboard — layout e placeholders (`dashboard-shell`)

## 1. Leitura para negócio

- **Para que serve:** envolver todas as rotas sob `/dashboard` com **navegação** (desktop e mobile), estado offline e **área de conteúdo**; algumas entradas de menu ainda apontam para **páginas placeholder**.
- **Quem usa:** clientes e prestadores autenticados (`ProtectedRoute` com `allowedRoles={['client','provider']}` no pai, com restrições nas rotas filhas).
- **Problema que resolve:** experiência consistente do painel após login.
- **Risco operacional:** usuário clica em “Endereços” no menu e vê “Página em construção”, embora endereços existam em **Minha conta** — ver feature [placeholders e menu](./features/placeholders-e-menu.md).

## 2. Features do módulo

| Feature | Documento |
|---------|-----------|
| Layout, menu e páginas placeholder | [features/placeholders-e-menu.md](./features/placeholders-e-menu.md) |

## 3. Evidências principais

- `src/layouts/DashboardLayout/DashboardLayout.tsx`
- `src/layouts/DashboardLayout/dashboardMenu.ts`
- `src/layouts/DashboardLayout/DashboardFakePage.tsx`
- `src/router.tsx` (filhos de `path: 'dashboard'`)
