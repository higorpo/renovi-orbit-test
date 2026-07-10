# Missão: elevar cobertura de testes unitários para ≥ 90%

Você é o agente de testes unitários do Orbit. Seu objetivo é **escrever e evoluir testes unitários funcionais** até que o escopo indicado atinja **no mínimo 90% de cobertura** em **todas** estas métricas:

| Métrica (Vitest/v8) | Equivalente pedido |
|---------------------|--------------------|
| Statements          | statements         |
| Lines               | lines              |
| Branches            | branches / conditions |
| Functions           | methods / functions |

**Critério de sucesso:** cobertura ≥ 90% em **cada** métrica no escopo; todos os testes passando; zero testes flaky.

---

## Escopo

**Alvo:** `<SUBSTITUA: ex. src/features/payments/ ou arquivo/pasta específica>`

Se o escopo for uma feature inteira, priorize nesta ordem:
1. `utils/` e validadores (regras puras)
2. `api/` (contratos com backend)
3. `hooks/` (orquestração / regras de negócio na UI)
4. `components/` com lógica ou estados relevantes
5. Só depois UI puramente apresentacional (se ainda faltar cobertura)

Ignore do esforço (já excluídos ou de baixo valor): `index.ts` de reexport, `*.types.ts` sem lógica, fixtures, snapshots de tipos.

---

## Princípios (obrigatórios)

### 1. Testes úteis > cobertura cosmética
- Cada teste deve validar **comportamento observável** ou **regra de negócio**.
- Proibido: testes que só “tocam” linhas sem assertiva significativa; snapshots frágeis de markup; asserts em detalhes de implementação (nomes internos, ordem de hooks, estrutura DOM irrelevante).
- Preferir: entradas → saídas; estados loading/success/error; branches de decisão; mensagens/códigos de erro; gates e bloqueios; edge cases reais do domínio.

### 2. Cobertura guiada por gaps, não por arquivo aleatório
1. Rode cobertura no escopo.
2. Liste arquivos/funções/branches **abaixo de 90%**.
3. Para cada gap, pergunte: *“qual regra de negócio ou caminho de falha isso representa?”*
4. Escreva o teste que cobre essa regra.
5. Re-meça. Repita até ≥ 90% em todas as métricas.

### 3. Não “forçar” cobertura
- Não altere código de produção só para facilitar cobertura, salvo bug óbvio ou extrair pure function já implícita.
- Não desabilite branches com `/* istanbul ignore */` / `v8 ignore` sem justificativa explícita (código morto, unreachable defensivo documentado).
- Se um branch for impossível de atingir de forma legítima, documente no relatório final e proponha remoção/simplificação do código.

---

## Stack e convenções do Orbit

- **Runner:** Vitest (`yarn test:run` / `yarn test:coverage`). Node **24.13**: `nvm use 24.13` antes de yarn.
- **Projetos:** `.test.tsx` → happy-dom; `.test.ts` → node. Se `.test.ts` precisar de DOM/`renderHook`/`window`/`@capacitor/*`, primeira linha: `// @vitest-environment happy-dom`.
- **Local:** `src/features/<feature>/.../__tests__/<nome>.test.ts(x)` (próximo ao código).
- **Arquitetura:** mockar API da feature; hooks não chamam Supabase direto; componentes mockam hooks quando o foco é UI.
- **RTL:** queries por role/label/text; interações de usuário.
- **Comentários / `it(...)`:** inglês; comentários só quando explicam o *porquê*.
- Seguir `.cursor/rules/unit-tests.mdc` e `.cursor/commands/unit-tests.md`.

### Por camada

| Camada | Foco do teste |
|--------|----------------|
| **utils / validators / Zod** | Casos válidos/inválidos, limites, null/empty, mapeamentos de erro, regras de cálculo/status |
| **api/** | Sucesso (shape), erro, parâmetros corretos ao client mockado; não rede real |
| **hooks/** | Estado inicial, transições, gates, side effects observáveis (toast/navegação) quando forem contrato |
| **components/** | Render + interação + estados expostos; mock de hooks/deps |

---

## Loop de trabalho (execute até concluir)

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 24.13

# Cobertura do escopo (ajuste o path)
yarn test:coverage -- <caminho-do-escopo>
```

1. **Baseline:** anote % de statements / branches / functions / lines.
2. **Gap analysis:** liste arquivos e branches não cobertos; agrupe por regra de negócio.
3. **Implemente** testes em lotes pequenos (1–3 arquivos por vez).
4. **Valide:** `yarn test:run -- <arquivos-ou-pasta>` — todos verdes.
5. **Re-meça cobertura** no escopo.
6. Se alguma métrica < 90%, volte ao passo 2.
7. Ao final, rode a suíte do escopo inteiro + cobertura e confirme ≥ 90% em **todas** as métricas.

Para um arquivo específico:
```bash
yarn test:coverage -- src/features/<feature>/caminho/arquivo.ts
# ou pasta:
yarn test:coverage -- src/features/<feature>
```

---

## Qualidade dos casos

Para cada unidade sob teste, cobrir quando aplicável:
- **Happy path** da regra principal
- **Falhas esperadas** (API error, validação, gate negado, idempotência, estado inválido)
- **Branches de decisão** (if/switch/ternário que mudam comportamento de negócio)
- **Edge cases de domínio** (null, lista vazia, expirado, retry, race documentada no código)
- **Mensagens/códigos** que o usuário ou o caller dependem

Evitar:
- Um único `it` gigante com muitos asserts não relacionados
- Duplicar o mesmo cenário com variações cosméticas
- Mock excessivo que esvazia a regra sob teste
- Testar bibliotecas de terceiros

---

## Checklist de regras de negócio (quando aplicável)

Se o escopo for pagamentos (ou houver doc de fluxos), use `docs/payment-system/tests.md` como mapa de regras a priorizar (checkout, cartões, cobrança, falhas, cancelamento/estorno, etc.). Cada item do checklist que tiver código no escopo deve ter pelo menos um teste que falharia se a regra fosse quebrada.

Para outras features, use a documentação de negócio em `docs/business/` e o comportamento real do código como fonte das regras.

---

## Entrega

Ao terminar, reporte:

1. **Cobertura final** (statements / branches / functions / lines) do escopo
2. **Arquivos de teste criados/alterados**
3. **Regras de negócio cobertas** (lista curta)
4. **Gaps remanescentes** (se algum branch legítimo ficou < 90% e por quê)
5. Confirmação: `yarn test:run` no escopo passou

Não faça commit a menos que eu peça explicitamente.
Não altere docs de negócio só por causa destes testes.
