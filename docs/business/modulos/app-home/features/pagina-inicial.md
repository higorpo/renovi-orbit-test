# Página inicial (`/`)

## 1. Visão geral

- **Objetivo do módulo:** ponto de entrada HTTP da aplicação na rota index.
- **Contexto de negócio:** identificação da marca e acesso rápido ao fluxo de login; **não** há marketing ou listagem de serviços neste componente.
- **Perfis envolvidos:** anônimo (sem distinção no código).
- **Dependências com outros módulos:** nenhuma importação de features de negócio; usa apenas `react-router` (`useNavigate`).

---

## 2. Telas e rotas

| Tela | Rota | Objetivo | Perfis com acesso |
|------|------|----------|-------------------|
| Home mínima | `/` | Título “Renovi” + botão para login | Qualquer (público) |

**Evidência:** `src/router.tsx` (child `index: true` de `/`); `src/App.tsx`.

---

## 3. Ações disponíveis

| Ação | Onde aparece | Quem pode executar | Regras | Efeitos |
|------|--------------|--------------------|--------|---------|
| Ir para login | Botão na home | Qualquer um | Nenhuma | `navigate('/login')` |

**Evidência:** `src/App.tsx` linhas 8–11.

---

## 4. Campos por tela

Não há campos de formulário.

---

## 5. Botões e comportamentos

### Home

| Botão/Ação | Comportamento | Validações prévias | Permissão | Resultado |
|------------|---------------|--------------------|-----------|-----------|
| Login | Navega para `/login` | — | Público | Troca de rota |

**Evidência:** `src/App.tsx` (texto do botão: `Login`).

---

## 6. Regras de negócio

- Nenhuma regra de domínio além da navegação declarada.

---

## 7. Perfis e permissões

| Perfil | Visualizar | Criar | Editar | Excluir | Aprovar | Outras ações |
|--------|------------|-------|--------|---------|---------|--------------|
| Anônimo | Sim | — | — | — | — | Navegar para login |

**Evidência:** rota index sem `ProtectedRoute` em `router.tsx`.

---

## 8. Tabelas, entidades e dados envolvidos

Nenhuma.

---

## 9. APIs, serviços e fluxos técnicos

| Camada | Nome | Responsabilidade | Arquivo/Caminho |
|--------|------|------------------|-----------------|
| UI | `App` | Render mínimo + navigate | `src/App.tsx` |
| Estilo | `App.css` | Estilos globais da página | `src/App.css` |

---

## 10. Fluxos operacionais

### Fluxo principal

1. Usuário abre `/`.
2. Vê “Renovi” e aciona o botão.
3. Aplicação navega para `/login`.

---

## 11. Mensagens do sistema

Nenhuma toast ou validação; apenas conteúdo estático da UI.

---

## 12. Evidências no código

- `src/App.tsx`
- `src/router.tsx`

---

## 13. Lacunas ou pontos não confirmados

| Item | Status | Observação |
|------|--------|------------|
| Produto final pretendido para `/` (landing, redirect por sessão, etc.) | Não localizado no código analisado | Implementação atual é deliberadamente mínima |

## 14. Atualização de auditoria (2026-04-27)

- **Sem regra de redirecionamento automático por sessão:** a página inicial não consulta auth; apenas renderiza conteúdo estático.
- **Ação única de negócio na home atual:** botão `Login` navega para `/login`.
- **Escopo intencionalmente enxuto:** não há coleta de dados, validação de formulário, integração de API ou persistência.
