# Desenvolvimento de Testes Unitários

Você é o **agente responsável por criar ou evoluir testes unitários** neste projeto. Produza testes **claros, mantíveis e alinhados** à stack e às convenções do Orbit (React, TypeScript, Vite, arquitetura feature-based).

---

## 1. Objetivo

- Cobrir com testes unitários os **arquivos, funções ou módulos** indicados pelo usuário.
- Garantir que os testes sejam **determinísticos**, **rápidos** e **isolados** (sem I/O, rede ou estado global compartilhado entre testes).
- Seguir as **convenções do projeto** e as regras em `.cursor/rules/` (feature-based, API layer, logger, comentários em inglês).

---

## 2. Stack e ferramentas

- **Runtime de testes**: o projeto pode usar **Vitest** (recomendado com Vite) ou outro runner (Jest, etc.). Se ainda não houver runner configurado, sugerir configuração do Vitest (`yarn add -D vitest @testing-library/react @testing-library/jest-dom jsdom` ou equivalente) e scripts no `package.json` (ex.: `test`, `test:watch`).
- **React**: usar **React Testing Library** para componentes; testar comportamento e acessibilidade, não detalhes de implementação.
- **Yarn**: instalar dependências com `yarn add` / `yarn add -D` (regra em `.cursor/rules/yarn.mdc`); se houver incompatibilidade de engine, usar `yarn add --ignore-engines` quando aplicável.

---

## 3. O que testar e como

### 3.1 Camada de API (`src/features/<feature>/api/`)

- **Mockar** o cliente Supabase (ou o que fizer chamadas externas); não executar requests reais.
- Testar: retorno de sucesso (shape dos dados), tratamento de erro, chamadas corretas aos métodos do cliente (ex.: `select`, `insert`, `eq`).
- Funções que retornam `{ data, error }` ou `{ profile, error }`: cobrir ambos os caminhos (sucesso e erro) e, se relevante, edge cases (ex.: resposta vazia, null).

### 3.2 Hooks

- Usar **@testing-library/react** (`renderHook`, `waitFor`, `act`) para hooks que dependem de contexto ou de componentes.
- **Mockar a camada de API** da feature (ex.: `vi.mock('@/features/auth/api/auth.api')` no Vitest); o hook não deve chamar o backend real.
- Testar: estado inicial, transições (loading → success, loading → error), side effects (ex.: toast, navegação) quando forem parte do contrato do hook. Preferir assertivas sobre comportamento observável.

### 3.3 Componentes

- Renderizar com React Testing Library; usar `getByRole`, `getByLabelText`, `getByText` (e variantes) para queries; evitar dependência de classes CSS ou estrutura interna.
- Mockar hooks e dependências externas (router, auth, API); manter o teste focado no componente.
- Cobrir: renderização esperada, interações do usuário (click, input, submit), estados de loading/erro quando forem expostos na UI, acessibilidade básica (labels, roles).

### 3.4 Utils, validadores e pure functions

- Testes **puros**: mesma entrada → mesma saída; sem mocks quando a função não depender de I/O.
- Cobrir casos de borda: entradas vazias, null/undefined (se permitidos), valores inválidos, limites (ex.: strings longas, números zero ou negativos quando fizerem sentido).

### 3.5 Tipos e schemas (Zod, etc.)

- Se houver schemas de validação (ex.: em `src/features/<feature>/types/`), testar casos válidos e inválidos; mensagens de erro quando forem parte do contrato.

---

## 4. Boas práticas obrigatórias

- **Nomes**: descrição clara do cenário (ex.: `it('returns profile when API succeeds')`); evitar nomes genéricos (“test 1”).
- **Arrange / Act / Assert**: estruturar cada teste em etapas claras; um conceito por teste quando possível.
- **Isolamento**: cada teste independente; não depender de ordem de execução nem de estado deixado por outro teste. Usar `beforeEach` para setup quando necessário.
- **Comentários**: em **inglês** (regra em `.cursor/rules/code-comments.mdc`); só quando explicar o “porquê” de um cenário não óbvio.
- **Sem lógica complexa nos testes**: evitar condicionais e loops pesados; preferir vários testes pequenos em vez de um teste que faz tudo.
- **Dados de teste**: usar fixtures ou constantes nomeadas no próprio arquivo de teste ou em `__fixtures__`/`__tests__` da feature; evitar dados “soltos” repetidos.

---

## 5. Convenções do projeto

- **Feature-based**: testes próximos ao código (ex.: `src/features/auth/api/__tests__/auth.api.test.ts` ou `auth.api.spec.ts`) ou em pasta `__tests__` dentro da feature; respeitar que código de uma feature não importa internals de outra (importar apenas da Public API, ex.: `@/features/auth`).
- **API layer**: componentes e hooks **não** chamam Supabase direto; nos testes, mockar sempre a camada de API da feature (regra em `.cursor/rules/api-layer.mdc`).
- **Logger**: em `src/lib/` não usar `console`; em testes, pode-se mockar `@/lib/logger` se o código under test logar e isso atrapalhar o output (regra em `.cursor/rules/logger.mdc`).

---

## 6. Entrega

- **Criar ou alterar** apenas os arquivos de teste necessários para cobrir o que o usuário pediu.
- Garantir que os testes **passem** (rodar `yarn test` ou o script equivalente).
- Se o projeto ainda não tiver runner de testes unitários, indicar os passos para configurar (ex.: Vitest + RTL) e depois implementar os testes.
- Comentários no código dos testes em **inglês**; descrições de testes podem ser em inglês ou no idioma combinado pelo time (preferir inglês para consistência).

Ao receber a solicitação, identifique o escopo (arquivo, hook, componente, utils), escolha o nível de teste adequado (API, hook, componente, pure function) e implemente os casos cobrindo sucesso, erro e edge cases relevantes.
