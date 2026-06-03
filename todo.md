home services app that lists local vendors app

Itens interessantes de ter na plataforma (futuro)

- Prestador poder adicionar um contato que ele já fez serviço para ser verificado na plataforma
- Forma de validar que o prestador é indicado para mulheres também
- Precisa permitir alterar valor combinado, adicionar itens extras, cliente aprova etc
- Usar IA pra ela criar novas perguntas baseado em tudo o que o cliente respondeu para que ele responda em caso de ter ficado alguma coisa em aberto, alguma coisa que o prestador teria que saber
- Colocar a IA pra sugerir fotos pra ele tirar que seriam interessantes pro prestador entender melhor o problema
- Poder denunciar perguntas feitas em trabalhos por infringir as regras da plataforma
- Poder denunciar pedidos de orçamento feitos na plataforma por infringir as regras
- Criar mecanismo de descontos de taxas, onde a gente pode definir a % de desconto em cima da taxa original, título e descrição para o desconto e a data de início e fim que o desconto pode ser aplicado
- Usar IA para sugerir datas pro profissional na hora de montar o orçamento dele
- Usar IA para melhorar a descrição do orçamento do profissional
- Refatorar os uploads de imagens para ser mais compartilhado
- Ajustar algoritmo de matching para ter pesos em relação a várias variáveis para calcular quais serviços seriam mais interessantes de mostrar primeiro.
- Verificar se é possível colocar caching de mutations para caso o usuário esteja sem internet isso ser enviado/sincronizado depois
- Quando enviar proposta ou entrar para ver detalhes de um pedido fora da área, perguntar ao prestador se ele quer adicionar aquela área
- Prestador de serviços ter um calendário de serviços que ele pode gerenciar na plataforma, integrado com as datas que ele passa na hora de fazer o orçamento
- Sistema de badges dos cards das telas de meus serviços e orçamentos para o cliente e prestador deveria ser unificado para manter consistência. Podemos unificar também o card de serviço para manter melhor consistência.
- Na tela de detalhes do chat, incluir botão para redirecionar usuário para tela de detalhes do pedido/serviço
- Criar tela exclusiva de detalhes do pedido/serviço que pode ser acessível via link. Tela de detalhes do pedido deve ser acessível para qualquer usuário logado e poderia permitir enviar propostas diretamente pelo link

Urgentes:

- Está dando erro para enviar imagens mesmo elas não tendo conteúdo errado
- Renomear todas as rotas para português para manter consistência
- Tela de onboarding do prestador, onde ele selecione as áreas de atuação e os serviços que ele faz, além de outras opções (verificação do perfil)
- Há um problema com a captura de localização no formato atual. Ele está trazendo localização errada no PC, tem que checar se no Windows está assim também.
- Componente de sem internet ainda fica em cima de cards atrapalhando, principalmente no mobile.
- Adicionar google analytics em todos os fluxos
- Sistema de verificação de perfil do prestador, onde ele anexa os documentos e a equipe interna avalia
- remoteconfig para não permitir cadastrar profissionais etc
- remoteconfig para redirecionar para grupo de whatsapp

Telas/fluxos restantes:

- Aceitar orçamento
- Pagamento de um serviço
- Chat realtime do serviço
- Visualização de detalhes de um serviço em execução
- Visualizar checklist de conclusão do serviço
- Avaliação do serviço após sua conclusão
- Sistema de disputas
- Sistema de notificação/tela de notificação
- Mesmo com cadastro manual precisa fazer aceite dos termos de uso
- Todo o painel administrativo

Coisas para verificar:

- Não deve mostrar trabalhos que eu enviei proposta na tela de trabalhos
- Quando proposta aceita e entrar na tela de um trabalho específico, redirecionar para tela do serviço em si.
- Prestadores marcados como "Pioneiros" tem taxa de serviço menor
- Direcionar prestador para que ele cadastre serviços que ele atenda para exibir trabalhos


Coisas para terminar do fluxo atual de trabalho:

- Adicionar testes unitários no módulo de client-budget
- Testar a tela de orçamentos do cliente no fluxo do mobile
- Testar a tela de meus serviços do cliente no fluxo do mobile
- Adicionar ações para os botões de Aceitar orçamento e recusar orçamento
- api.github.com precisa ser removida.
- adicionar na tela de orçamento a escolha do cliente de uma data para realização do serviço, se o prestador tiver na plataforma um conflito de horário/data não mostrar aquela opção.
- ao gerar a descrição do pedido, também gerar o checklist de conclusão do serviço
  - mostrar o checklist de conclusão do serviço pro prestador na hora que ele vai fazer o orçamento e permitir que ele altere alguma coisa
  - apresentar o checklist de conclusão do serviço para o cliente quando ele vai fechar o serviço
- Permitir que o prestador veja perguntas feitas por outros prestadores (não precisa estar respondida)
- Permitir que um cliente receba até 5 propostas ao invés de 3
- Adicionar integração com IA que avalia a melhor proposta e faz um resumo


Coisas para fazer next

-verificar se devo manter colunas de status como text ou transformar em enum
-ajustar para que mensagens do message dispatcher com bypass não contem no total de mensagens do dia
-verificar necessidade de usar outbound  (domain_events) em outros eventos assíncronos
-serviços podem ter agendamento multi-dias
-verificar se precisaria usar cns_idempotency_records em outros lugares (talvez vou precisar criar antes)
  - adicionar nas regras que temos esse mecanismo para ser usado para que no futuro outras features possam usar quando necessário
-verificar se no sistema atual tenho coisas para usar job_runs (talvez vou precisar criar antes)
-depois que migrar todo o sistema e tiver tudo funcionando, podemos excluir /home/higor/Área de Trabalho/Renovi/orbit/supabase/migrations/20260701105400_delegate_create_provider_proposal_to_submit.sql e as rpcs relacionadas ao modelo antigo
-talvez não precisamos da tabela exclusiva de rate limit do chat e podemos usar a genérica
-verificar se usos anteriores a /home/higor/Área de Trabalho/Renovi/orbit/supabase/migrations/20260701106100_create_job_run_helpers.sql não poderiam se beneficiar desses helpers
- /home/higor/Área de Trabalho/Renovi/orbit/src/lib/analytics/pushChatAnalyticsEvent.ts provavelmente é desnecessário
- /home/higor/Área de Trabalho/Renovi/orbit/src/lib/analytics/events.ts é exclusivo do chat, talvez faça mais sentido mover o arquivo depois
-rever regras, hoje parece que para uma provider_proposal existir é obrigatório ter um chat envolvido ... as políticas RLS também foram alteradas.
-novas políticas RLS estão fora do padrão adotado que era ter descrição clara
-remover código /home/higor/Área de Trabalho/Renovi/orbit/src/features/provider-jobs/components/ProviderProposalComposerDialog.tsx e converter /home/higor/Área de Trabalho/Renovi/orbit/src/features/negotiation-proposals/components/ProposalComposer.tsx na dialog full
-remover código /home/higor/Área de Trabalho/Renovi/orbit/src/features/provider-jobs/hooks/useProviderProposalComposer.ts
-cobertura de testes em todos os códigos novos
-existe uma certa lentidão para disparar push de novas mensagens (ele cai numa fila de processamento para enviar pro message dispatcher e  depois ainda espera o job do message dispatcher...)
- usar trigger ao invés de criar essa tabela central...
- para que serve CHAT_PROPOSAL_TIMELINE_QUERY_KEY? podemos remover?
-remover referencia de chat e novas colunas do provider_proposals, renomear tabela.


ATUALIZAR:
Essas são as **funções/RPCs** que ainda comparam `service_requests.status` com os valores legados em texto (`'open'`, `'in_progress'`, `'closed'`, `'cancelled'`). Com o enum novo (`OPEN`, `COMPLETED`, `CANCELLED`), essas comparações **param de bater** — em geral retornam vazio ou lançam erro.

### Matching e propostas (provider)

| RPC | Arquivo | Comparação legada |
|-----|---------|-------------------|
| `public.match_provider_jobs` | `20260318200001_match_provider_jobs_rpc.sql` | `sr.status = 'open'` |
| `public.get_provider_proposal_job_detail` | `20260323120000_get_provider_proposal_job_detail.sql` | `sr.status = 'open'` |
| `public.create_provider_proposal` | `20260320110000_harden_provider_proposal_pricing_signature.sql` | `v_service_request_status <> 'open'` (recebe `'OPEN'` do enum e sempre falha) |

### Perguntas (provider ↔ client)

| RPC | Arquivo | Comparação legada |
|-----|---------|-------------------|
| `public.can_provider_ask_question` | `20260318200002_provider_service_request_question_eligibility.sql` | `sr.status = 'open'` |
| `public.create_provider_service_request_question` | mesmo arquivo | indireto — chama `can_provider_ask_question` |
| `public.list_provider_service_request_questions` | `20260226100300_create_service_requests.sql` | `sr.status = 'open'` |
| `public.list_provider_own_questions` | `20260322000000_create_provider_budgets_rpcs.sql` | `'open'`, `'in_progress'`, `'closed'`, `'cancelled'` (filtro `p_question_status`) |

### Orçamentos — tela do provider

| RPC | Arquivo | Comparação legada |
|-----|---------|-------------------|
| `public.list_provider_sent_budgets` | `20260322000000_create_provider_budgets_rpcs.sql` | **não filtra** por status legado; só **retorna** `sr.status` no JSON (valor passa a ser `'OPEN'`, etc.) |

### Orçamentos — tela do client

| RPC | Arquivo | Comparação legada |
|-----|---------|-------------------|
| `public.list_client_received_budgets` | `20260323090000_create_client_budgets_rpcs.sql` | `sr.status in ('open', 'in_progress')` |
| `public.list_client_budget_questions` | mesmo arquivo | `'open'`, `'in_progress'` (filtros, counts e `g.service_request_status = 'open'`) |
| `public.reject_client_budget_proposal` | mesmo arquivo | `sr.status in ('open', 'in_progress')` |

### Sem comparação legada (só leem/devolvem status)

Estas **não quebram** por comparação, mas o JSON passa a expor enum (`OPEN`, etc.) em vez de texto minúsculo:

- `public.get_client_budget_service_request_detail`
- `public.respond_client_budget_question`

---

**Resumo:** **10 RPCs** precisam de atualização explícita; **1** (`list_provider_sent_budgets`) só muda o formato do valor retornado; **2** só propagam o enum no response.

**Mapeamento sugerido** (conforme a migration CNS):

| Legado | Novo enum |
|--------|-----------|
| `'open'`, `'in_progress'`, `'closed'` | `'OPEN'` |
| `'cancelled'` | `'CANCELLED'` |
| aceite de proposta | `'COMPLETED'` |

A policy de storage `"Clients providers and admins can read question response images"` já foi corrigida na migration `20260701101200`. A definição original em `20260323090000_create_client_budgets_rpcs.sql` ainda tem `'open'`, mas é sobrescrita na migration CNS.




---

-ajustar o online