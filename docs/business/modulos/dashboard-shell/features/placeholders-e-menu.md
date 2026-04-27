# Dashboard — layout, menu e páginas placeholder

## 1. Visão geral

- **Objetivo do módulo:** fornecer o **shell** do painel (`DashboardLayout`) com header (desktop), navegação inferior (mobile) e conteúdo via `<Outlet />`.
- **Contexto de negócio:** após autenticação, cliente e prestador acessam funções de pedidos, orçamentos e conta; parte das rotas ainda não tem implementação além do título.
- **Perfis envolvidos:** `client` e `provider` (derivado de `useAuth().profile.role`); itens de menu diferem por papel.
- **Dependências com outros módulos:** renderiza **páginas reais** importadas no router (`my-account`, `client-my-services`, `client-budgets`, `provider-jobs`, etc.); placeholders **não** importam features de negócio.

---

## 2. Telas e rotas

| Tela | Rota | Objetivo | Perfis com acesso |
|------|------|----------|-------------------|
| Shell (sem título próprio) | `/dashboard/*` | Layout + nav | `client`, `provider` (pai) |
| Visão geral (placeholder) | `/dashboard` | Marcador de posição | `client`, `provider` |
| Endereços (placeholder) | `/dashboard/addresses` | Marcador; **não** usa feature `addresses` | Somente `client` (guard aninhado) |
| Configurações (placeholder) | `/dashboard/settings` | Marcador | `client`, `provider` |
| Ajuda (placeholder) | `/dashboard/help` | Marcador | `client`, `provider` |
| Ganhos (placeholder) | `/dashboard/earnings` | Marcador | Somente `provider` (guard aninhado) |

**Evidência:** `src/router.tsx` (rotas filhas de `dashboard` com `DashboardFakePage`); `DashboardFakePage.tsx`.

**Menu lateral / bottom nav:** `src/layouts/DashboardLayout/dashboardMenu.ts` — `getDashboardMenu(role)` retorna labels e paths; cliente inclui `Visão geral`, `Meus Serviços`, `Orçamentos`, `Endereços`, `Minha conta`, `Ajuda`; prestador inclui `Visão geral`, `Solicitações`, `Trabalhos`, `Orçamentos`, `Ganhos`, `Minha conta`, `Ajuda`.

---

## 3. Ações disponíveis

| Ação | Onde aparece | Quem pode executar | Regras | Efeitos |
|------|--------------|--------------------|--------|---------|
| Navegar pelo menu | Header (desktop) / bottom nav (mobile) | Conforme itens do menu para o papel | Requer sessão válida no layout protegido | `react-router` navegação |
| Ver título da página placeholder | Dentro do `Card` | Mesmo do guard da rota | Nenhuma | Exibe título + texto “Página em construção.” |

**Evidência:** `DashboardLayout.tsx`, `DesktopNav.tsx`, `MobileNav.tsx`, `DashboardFakePage.tsx`.

---

## 4. Campos por tela

Placeholder **não possui** formulários, filtros nem campos de entrada.

---

## 5. Botões e comportamentos

### Páginas `DashboardFakePage`

| Botão/Ação | Comportamento | Validações prévias | Permissão | Resultado |
|------------|---------------|--------------------|-----------|-----------|
| — | — | — | — | Nenhum botão de ação no componente |

**Evidência:** `DashboardFakePage.tsx` (apenas `Card` + título + parágrafo).

---

## 6. Regras de negócio

- Título exibido: prop `title` **ou** `titleByRole[profile.role]` **ou** fallback `"Dashboard"` — `profile?.role ?? "client"` quando necessário.
- Rotas placeholder **não** aplicam regras de domínio (pedido, orçamento, etc.).

**Evidência:** `DashboardFakePage.tsx` linhas 15–21.

---

## 7. Perfis e permissões

| Perfil | Visualizar placeholders gerais | `/dashboard/addresses` | `/dashboard/earnings` |
|--------|--------------------------------|-------------------------|------------------------|
| client | Sim (onde router permitir) | Sim | Não (rota com `allowedRoles={['provider']}`) |
| provider | Sim (onde router permitir) | Não | Sim |

**Evidência:** `src/router.tsx`.

---

## 8. Tabelas, entidades e dados envolvidos

Nenhuma persistência ou query no layout/placeholder além de leitura de `profile` para menu e título.

**Evidência:** `useAuth()` em `DashboardLayout.tsx` e `DashboardFakePage.tsx`.

---

## 9. APIs, serviços e fluxos técnicos

| Camada | Nome | Responsabilidade | Arquivo/Caminho |
|--------|------|------------------|-----------------|
| UI | `DashboardLayout` | Shell + offline banner implícito (`useOnlineStatus`) | `layouts/DashboardLayout/DashboardLayout.tsx` |
| Config | `getDashboardMenu` | Itens por papel | `layouts/DashboardLayout/dashboardMenu.ts` |
| UI | `DashboardFakePage` | Placeholder | `layouts/DashboardLayout/DashboardFakePage.tsx` |
| Roteamento | `createBrowserRouter` | Árvore de rotas | `src/router.tsx` |

---

## 10. Fluxos operacionais

### Fluxo principal

1. Usuário autenticado entra em uma rota `/dashboard/...`.
2. `DashboardLayout` monta menu conforme `profile.role`.
3. `Outlet` renderiza a página filha (real ou `DashboardFakePage`).

### Fluxos alternativos

1. **Offline:** layout ajusta posição do header quando `!isOnline` (`top-11` vs `top-0`) — `DashboardLayout.tsx`.

---

## 11. Mensagens do sistema

| Tipo | Mensagem | Quando ocorre |
|------|----------|----------------|
| UI fixa | “Página em construção.” | Qualquer rota que usa `DashboardFakePage` |
| Loading guest guard | “Carregando...” | Não é deste módulo; está em `GuestOnlyRoute` |

---

## 12. Evidências no código

- `src/router.tsx` — definição de `dashboard` e filhos com `DashboardFakePage`.
- `src/layouts/DashboardLayout/DashboardFakePage.tsx` — texto e lógica de título.
- `src/layouts/DashboardLayout/dashboardMenu.ts` — itens do menu cliente vs prestador.

---

## 13. Lacunas ou pontos não confirmados

| Item | Status | Observação |
|------|--------|------------|
| Conteúdo futuro de `/dashboard/settings`, `/dashboard/help` | Não localizado | Apenas placeholder no código analisado |
| Por que `/dashboard/addresses` não renderiza `AddressesSection` | Decisão de produto | Não explicitada em comentário no router; comportamento apenas inferido pela escolha de componente |
