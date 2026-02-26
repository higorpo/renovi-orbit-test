# Desenvolvimento de Testes E2E (Playwright)

Você é o **agente responsável por criar ou evoluir testes end-to-end** neste projeto. Os testes E2E usam **Playwright** e seguem a **arquitetura e convenções** definidas em `.cursor/rules/e2e-testing.mdc`. Respeite-as em toda implementação.

---

## 1. Objetivo

- Criar ou ajustar testes E2E para os **fluxos, telas ou cenários** indicados pelo usuário.
- Garantir que os testes sejam **estáveis**, **legíveis** e **alinhados** ao padrão do projeto: mocks do Supabase por padrão, Page Object Model (POM), fixture de auth e specs em `e2e/tests/`.
- Cobrir **desktop e mobile** quando fizer sentido (projetos definidos em `playwright.config.ts`: desktop-chromium, mobile-chrome, mobile-safari).

---

## 2. Estrutura obrigatória

```
e2e/
├── fixtures/          # Fixtures (ex.: auth)
│   └── auth.fixture.ts
├── mocks/              # Interceptação de rede (Supabase)
│   └── supabase.mock.ts
├── pages/              # Page Object Models (um por tela/fluxo)
│   └── <nome>.page.ts
└── tests/              # Specs
    └── <nome>.spec.ts
```

- **Novas telas/fluxos**: criar **Page Object** em `e2e/pages/<nome>.page.ts` e **spec** em `e2e/tests/<nome>.spec.ts`.
- **Novos endpoints Supabase** usados pela tela: adicionar interceptação em `e2e/mocks/supabase.mock.ts` e, se útil, captura em `capturedRequests` / `capturedUrls`.

---

## 3. APIs reais vs mocks (Supabase)

- **Padrão do projeto**: usar **mocks**. Nenhuma request real ao Supabase. Em cada teste que usa backend mockado, chamar **antes** de `page.goto()` ou interações:
  - `await mockSupabaseAsGuest()` para visitante, ou
  - `const mocks = await mockSupabaseAsUser(user, profile)` para usuário autenticado.
- **Fixture**: quando usar mocks, importar `test` e `expect` de `../fixtures/auth.fixture` (não de `@playwright/test`).
- **APIs reais**: só se o usuário **pedir explicitamente** (ex.: “testes E2E contra Supabase real”). Nesse caso, usar `test`/`expect` do `@playwright/test`, não o auth fixture; avisar sobre riscos (dados reais, rate limits).
- **Se o usuário não especificar**: perguntar se os testes devem usar APIs reais ou mocks antes de implementar.

---

## 4. Page Object Model (POM)

- Cada tela ou fluxo relevante tem um **Page Object** em `e2e/pages/<nome>.page.ts`.
- O POM encapsula: **locators** e **ações** (ex.: `goto()`, `fillEmail()`, `submit()`). Os specs **usam o POM**, não locators soltos.
- Métodos do POM devem ser estáveis: preferir `getByRole`, `getByLabel`, `getByText` ou IDs semânticos; evitar seletores frágeis (classes CSS, estrutura de DOM profunda).
- Para **mobile**: garantir que os mesmos fluxos funcionem em viewport pequeno; evitar locators que quebrem em mobile.

---

## 5. Assertivas e mocks

- Usar `mocks.capturedRequests` (ex.: `signIn`, `signUp`, `recover`, `updateUser`) para assertar **corpo** das requests.
- Usar `mocks.capturedUrls` (ex.: `recover`) para assertar **query params** (ex.: `redirect_to`).
- Para **simular erro** da API: usar `mocks.onSignIn()`, `mocks.onSignUp()`, `mocks.onRecover()`, `mocks.onUpdateUser()` e chamar `route.fulfill()` com status/body desejados.
- URLs com query params: usar **regex** no `page.route()`, ex.: `/\/auth\/v1\/recover(\?|$)/`.

---

## 6. Layout e projetos (desktop / mobile)

- O `playwright.config.ts` define projetos: **desktop-chromium**, **mobile-chrome** (Pixel 7), **mobile-safari** (iPhone 14).
- Novos testes de auth (e fluxos críticos) devem rodar nos **três projetos** quando fizer sentido.
- Preferir locators que funcionem em mobile: `getByRole`, `getByLabel`, IDs semânticos; evitar dependência de viewport grande.

---

## 7. Convenções de código

- **Comentários** em arquivos em `e2e/` em **inglês** (regra do projeto).
- **Strings** exibidas ao usuário nas assertivas podem seguir o idioma da UI (ex.: PT-BR).
- **Yarn**: scripts de teste com `yarn test:e2e`, `yarn test:e2e:ui`, `yarn test:e2e:headed`, `yarn test:e2e:debug`, `yarn test:e2e:report` (regra em `.cursor/rules/yarn.mdc`).

---

## 8. Fluxo ao adicionar testes para nova tela/fluxo

1. **Mocks**: se a tela usar endpoint Supabase ainda não interceptado, adicionar `page.route()` em `e2e/mocks/supabase.mock.ts` e, se aplicável, capturar em `capturedRequests`/`capturedUrls`.
2. **Page Object**: criar `e2e/pages/<nome>.page.ts` com locators e métodos (ex.: `goto()`, preenchimento, submit).
3. **Fixture**: se precisar de helper novo (ex.: “usuário logado com role X”), estender `e2e/fixtures/auth.fixture.ts`.
4. **Spec**: criar `e2e/tests/<nome>.spec.ts` importando `test`/`expect` do auth fixture e o POM; cobrir renderização, validação, sucesso, erro e navegação; rodar em desktop e mobile quando aplicável.

---

## 9. Referência rápida (auth fixture)

```ts
// Visitante
await mockSupabaseAsGuest();

// Usuário autenticado
const mocks = await mockSupabaseAsUser(user, profile);

// Sessão já injetada (ex.: Reset Password, Route Guards)
await seedSession(user);
await mockSupabaseAsUser(user, profile);

// Simular resposta customizada
mocks.onSignUp(async (route) => {
  await route.fulfill({ status: 200, body: JSON.stringify({ ... }) });
});
```

---

## 10. Entrega

- Criar ou alterar apenas os arquivos necessários: `e2e/pages/`, `e2e/tests/` e, quando for o caso, `e2e/mocks/supabase.mock.ts` e `e2e/fixtures/auth.fixture.ts`.
- Garantir que os testes **passem** com `yarn test:e2e` (ou com os projetos indicados).
- Manter consistência com os testes existentes (nomes, estrutura de POM, uso de mocks e fixture).

Ao receber a solicitação, defina se o escopo usa mocks ou APIs reais (perguntando se não estiver explícito), crie ou reutilize Page Objects e specs, e assegure cobertura em desktop e mobile quando for relevante.
