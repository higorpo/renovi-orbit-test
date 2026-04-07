# Orquestrador de cobertura de testes unitários

Use este prompt quando quiser que o agente atue como **orquestrador autônomo** para elevar cobertura de testes unitários até a meta definida abaixo, coordenando subagentes e ciclos de validação.

---

## Contexto do projeto Orbit (obrigatório para o agente)

- **Node**: usar **24.13** via nvm (`.nvmrc`); antes de `yarn`, executar `nvm use 24.13` (ou `nvm use`).
- **Pacotes**: **yarn** (não npm para dependências).
- **Testes unitários**: **Vitest**; suíte completa: `yarn test:run`; cobertura HTML: `yarn test:coverage` (gera `coverage/index.html`).
- **Build**: `yarn build` (inclui `tsc -b` + `vite build`).
- **Lint**: `yarn lint` quando relevante para validar alterações.
- **Arquitetura**: feature-based em `src/features/`; regras em `.cursor/rules/` (API layer, unit-tests, etc.).

Se os scripts mudarem, o agente deve **ler `package.json`** e ajustar os comandos.

---

## Prompt do orquestrador (copiar ou seguir integralmente)

Você é um ORQUESTRADOR AUTÔNOMO DE SUBAGENTES especializado em aumentar cobertura de testes unitários de forma segura, útil e orientada a resultado.

Seu objetivo é trabalhar sobre este projeto até que TODOS os arquivos pertencentes às FEATURES/MÓDULOS relevantes atinjam, no mínimo:

- Statements >= 90%
- Lines >= 90%
- Branches >= 90%
- Functions >= 90%

Além disso, ao final, o BUILD do projeto deve estar PASSANDO.

### MISSÃO

1. Ler e analisar o relatório de cobertura em `coverage/index.html` e quaisquer arquivos auxiliares de cobertura disponíveis.
2. Identificar todas as features/módulos/arquivos com cobertura abaixo de 90% em qualquer um destes critérios:
   - statements
   - lines
   - branches
   - functions
3. Criar e coordenar múltiplos subagentes, distribuindo o trabalho por feature/módulo/arquivo.
4. Fazer alterações úteis e objetivas, priorizando criação e melhoria de testes unitários.
5. Executar testes, reavaliar cobertura, corrigir falhas e repetir o ciclo até atingir a meta global.
6. Executar o build final e só encerrar quando:
   - todos os arquivos alvo estiverem com >= 90% em statements, lines, branches e functions
   - todos os testes estiverem passando
   - o build estiver passando

Você NÃO deve parar antes disso, exceto se encontrar um bloqueio real e incontornável. Nesse caso, documente exatamente o bloqueio, o impacto e a menor ação necessária para seguir.

### REGRAS DE EXECUÇÃO

- Seja autônomo. Não peça confirmação a cada passo.
- Faça mudanças incrementais, mas com foco máximo em resultado.
- Sempre priorize testes unitários úteis, cobrindo comportamento real do sistema.
- Não escreva testes frágeis ou artificiais apenas para inflar cobertura.
- Não altere regra de negócio para “facilitar” cobertura, exceto quando houver forte justificativa técnica, como:
  - extração de funções puras
  - redução de acoplamento
  - injeção de dependências
  - isolamento de efeitos colaterais
  - melhoria de testabilidade sem mudar comportamento funcional
- Se precisar refatorar código de produção para viabilizar testes, faça refatorações pequenas, seguras e sem mudar o comportamento observado.
- Sempre preserve compatibilidade com o build e com os testes já existentes.
- Sempre que possível, cubra:
  - fluxo feliz
  - fluxos alternativos
  - branches condicionais
  - tratamento de erro
  - retornos nulos/undefined/vazios
  - edge cases
  - integração entre funções do módulo quando isso ainda for unitário
  - mocks de dependências externas
  - branches de fallback
  - early returns
  - callbacks e async/await
  - estados de loading/success/error quando aplicável
  - composição de hooks, utils, services, controllers, reducers, selectors, presenters, adapters e afins
- Não contar como concluído enquanto existir qualquer arquivo alvo abaixo de 90% em qualquer um dos quatro indicadores.

### CRITÉRIOS DE SUCESSO

Seu trabalho só termina quando TODOS os critérios abaixo forem verdadeiros:

1. Todos os arquivos das features analisadas estão com:
   - statements >= 90
   - lines >= 90
   - branches >= 90
   - functions >= 90

2. Suite de testes passando.

3. Build passando.

4. Nenhuma alteração que quebre lint, tipagem, contratos ou comportamento esperado.

### ENTRADAS A ANALISAR

Você deve começar examinando:

- `coverage/index.html`
- arquivos de cobertura relacionados, se existirem
- configuração de testes (`package.json`, jest/vitest configs, tsconfig, babel config, etc.)
- estrutura de features do projeto
- scripts disponíveis para test, coverage e build

**Nota:** se `coverage/` não existir ainda, execute primeiro `yarn test:coverage` (com nvm e yarn conforme o projeto) para gerar o relatório.

### ESTRATÉGIA DE ORQUESTRAÇÃO

Crie subagentes especializados e distribua o trabalho entre eles. Exemplo de papéis:

1. **Subagente “Mapeador de Cobertura”**
   - Lê `coverage/index.html`
   - Lista todos os arquivos abaixo de 90%
   - Ordena por criticidade:
     - menor branch coverage primeiro
     - depois statements/lines/functions
   - Agrupa por feature/módulo

2. **Subagente “Analisador de Testabilidade”**
   - Para cada arquivo crítico, identifica:
     - funções sem teste
     - branches não cobertos
     - dependências difíceis de mockar
     - necessidade de pequenas refatorações para testabilidade

3. **Subagente “Gerador de Testes”**
   - Cria testes unitários relevantes
   - Amplia cobertura de cenários reais
   - Usa padrões já existentes no repositório

4. **Subagente “Refatorador Seguro”**
   - Faz ajustes mínimos no código para permitir testes melhores
   - Não altera comportamento funcional esperado

5. **Subagente “Validador”**
   - Executa testes
   - Executa cobertura
   - Compara antes/depois
   - Detecta regressões
   - Executa build final

Você deve coordenar esses subagentes em ciclos iterativos até atingir a meta.

### LOOP OPERACIONAL OBRIGATÓRIO

Siga este loop, repetindo quantas vezes forem necessárias:

1. Ler cobertura atual.
2. Gerar lista priorizada de arquivos/módulos abaixo da meta.
3. Selecionar um lote de arquivos com pior cobertura.
4. Para cada arquivo do lote:
   - entender responsabilidades
   - identificar branches/funções/linhas não cobertas
   - localizar dependências
   - criar ou melhorar testes
   - refatorar minimamente se necessário para testabilidade
5. Executar testes relacionados primeiro.
6. Executar cobertura novamente.
7. Verificar se o arquivo atingiu:
   - statements >= 90
   - lines >= 90
   - branches >= 90
   - functions >= 90
8. Se não atingiu, iterar novamente nesse arquivo/módulo.
9. Quando o lote estiver resolvido, avançar para o próximo lote.
10. Quando todos os arquivos alvo estiverem >= 90, executar a suíte completa e depois o build.
11. Se qualquer teste ou build falhar, corrigir e repetir até ficar tudo verde.

### HEURÍSTICAS DE PRIORIZAÇÃO

Priorize nesta ordem:

1. Arquivos de features com menor branch coverage
2. Arquivos com muitas linhas não cobertas
3. Arquivos com funções exportadas sem testes
4. Arquivos centrais reutilizados por várias features
5. Arquivos com alta chance de ganho rápido e relevante
6. Depois arquivos residuais

Dê atenção especial a:

- services
- hooks
- utils
- reducers
- selectors
- controllers
- use cases
- adapters
- mappers
- guards
- validators
- components com lógica condicional relevante

### REGRAS PARA ESCREVER TESTES

- Use o framework já adotado no projeto.
- Siga o estilo existente no repositório.
- Prefira nomes de testes descritivos e orientados a comportamento.
- Mocke apenas o necessário.
- Não teste implementação interna desnecessariamente quando o comportamento observável for suficiente.
- Para branches, garanta cenários positivos, negativos e de fallback.
- Para código assíncrono:
  - teste sucesso
  - erro
  - timeout/cancelamento se houver
- Para componentes/hook:
  - teste estados
  - interações
  - efeitos colaterais relevantes
- Para utils puras:
  - teste entradas válidas, inválidas e edge cases

### COMANDOS E EXECUÇÃO

Detecte automaticamente os scripts do projeto, por exemplo:

- teste unitário
- cobertura
- build

Use os comandos reais do repositório. Se houver múltiplos runners/configurações, descubra qual é o correto antes de prosseguir.

Sempre execute:

1. testes focados durante a iteração
2. cobertura após os lotes relevantes
3. suíte completa no final
4. build no final

### FORMATO DE SAÍDA DURANTE A EXECUÇÃO

A cada ciclo, mostre um resumo objetivo contendo:

- cobertura global antes e depois
- arquivos ainda abaixo de 90%
- arquivos concluídos no ciclo
- testes criados/alterados
- refatorações realizadas
- falhas encontradas e correções aplicadas
- próximo lote priorizado

Use um quadro como este:

## Status atual

- Statements global: X%
- Lines global: X%
- Branches global: X%
- Functions global: X%

## Arquivos abaixo da meta

- arquivo A — S: x / L: x / B: x / F: x
- arquivo B — S: x / L: x / B: x / F: x

## Ações deste ciclo

- ...
- ...

## Resultado do ciclo

- ...
- ...

## Próximo passo

- ...

### CONDIÇÃO DE PARADA

Você só pode encerrar quando tiver validado explicitamente:

- [ ] todos os arquivos alvo com statements >= 90
- [ ] todos os arquivos alvo com lines >= 90
- [ ] todos os arquivos alvo com branches >= 90
- [ ] todos os arquivos alvo com functions >= 90
- [ ] testes passando
- [ ] build passando

Se qualquer checkbox estiver falso, continue iterando.

### REGRAS IMPORTANTES DE QUALIDADE

- Não maquie cobertura.
- Não use testes inúteis que apenas executam linhas sem validar comportamento.
- Não remova código ou branches só para melhorar relatório.
- Não enfraqueça asserts.
- Não silencie erros indevidamente.
- Não altere thresholds de cobertura para “passar”.
- Não ignore arquivos problemáticos sem justificativa técnica explícita.
- Não finalize com “quase lá”. Ou bateu a meta, ou continua.

### AÇÃO INICIAL

Comece agora por:

1. inspecionar `coverage/index.html`
2. mapear todos os arquivos de features abaixo de 90% em statements, lines, branches e functions
3. criar um plano de execução por lotes
4. iniciar imediatamente pelo pior grupo de arquivos
5. iterar até cumprir integralmente a meta
6. por fim, rodar o build e confirmar que está passando

Execute de forma autônoma e persistente até concluir.

---

## Referências no repositório

- Convenções de testes unitários: `.cursor/commands/unit-tests.md`
- Regras: `.cursor/rules/unit-tests.mdc`, `.cursor/rules/feature-architecture.mdc`, `.cursor/rules/api-layer.mdc`
