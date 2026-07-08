# Sistema de Reagendamento e Cancelamento de Serviços - Renovi

## Objetivo

Permitir que clientes possam reagendar ou cancelar serviços já contratados de forma organizada, protegendo tanto a experiência do cliente quanto a disponibilidade e previsibilidade da agenda dos prestadores.

O sistema deve:

* Dar flexibilidade ao cliente.
* Evitar prejuízos operacionais para os prestadores.
* Utilizar o chat como principal canal de negociação.
* Garantir que acordos sejam formalizados dentro da plataforma.
* Manter rastreabilidade de todas as alterações realizadas.

---

# Contexto Atual da Plataforma

Fluxo atual de contratação:

1. Cliente publica um pedido de serviço.
2. Prestadores interessados entram em contato através do chat.
3. Prestador envia uma proposta.
4. Cliente aceita a proposta.
5. Cliente cadastra um cartão de crédito.
6. Cliente escolhe uma das datas sugeridas pelo prestador.
7. Serviço é marcado como Agendado.
8. A cobrança é realizada 48 horas antes da data agendada.
9. Caso o pagamento não seja aprovado até 24 horas antes da execução, o serviço é cancelado automaticamente.

---

# Princípios Adotados

## 1. O chat é o centro da negociação

A Renovi possui um sistema de mensagens robusto.

Portanto:

* Negociações devem acontecer naturalmente dentro do chat.
* O sistema não deve tentar substituir a conversa entre cliente e prestador.
* O sistema deve apenas formalizar acordos.

---

## 2. Toda alteração precisa ser formalizada

Nenhuma alteração de data será considerada válida apenas por mensagens trocadas no chat.

Para que uma nova data seja oficializada:

* O prestador deve enviar uma alteração de agendamento pela plataforma.
* O cliente deve aceitar a alteração.
* Somente após a aceitação a nova data passa a valer.

Enquanto isso não acontecer:

* A data original permanece válida.

---

# Sistema de Reagendamento

## Objetivo

Permitir que o cliente solicite a alteração da data de execução do serviço sem cancelar a contratação.

---

## Regra Principal

O cliente pode solicitar um reagendamento até 48 horas antes da data agendada.

Após esse prazo:

* O botão de reagendamento deixa de estar disponível.
* O cliente poderá apenas cancelar o serviço.

---

## Motivo da Regra

A plataforma realiza a cobrança 48 horas antes da execução.

Ao alinhar o prazo de reagendamento com o momento da cobrança:

* Evitamos conflitos financeiros.
* Evitamos necessidade de estornos.
* Simplificamos a operação.
* Protegemos a agenda do prestador.

---

## Fluxo de Reagendamento

### Etapa 1 — Cliente ou prestador solicitam reagendamento

O cliente ou o prestador acessa o serviço e clica em:

"Solicitar Reagendamento"

---

### Etapa 2 — Sistema cria registro formal

O sistema:

* Altera o status para "Reagendamento Solicitado".
* Insere uma mensagem automática no chat.

Exemplo:

"João solicitou o reagendamento do serviço agendado para 15/11. Converse pelo chat para definir uma nova data."

---

### Etapa 3 — Negociação pelo chat

Cliente e prestador negociam livremente.

Exemplo:

Cliente:
"Podemos fazer na próxima semana?"

Prestador:
"Tenho disponibilidade terça ou quinta."

Cliente:
"Quinta funciona para mim."

---

### Etapa 4 — Formalização da nova data

Após chegarem a um acordo:

O prestador clica no action banner em:

"Atualizar Agendamento"

Informando:

* Tempo estimado para executar e unidade (horas/dias), pré-preenchidos do serviço contratado e editáveis (máx. 24 h / 7 dias).
* Nova data (ou período, quando a duração informada for multi-dia).
* Novo turno.

**Comportamento comprovado no produto (Orbit) — forma da data proposta:** a UI de “Propor nova data” permite editar **tempo estimado** e **unidade**, pré-preenchidos de `duration_unit` / `duration_value` do serviço contratado. O modo de data (com ou sem fim) deriva da duração **informada na proposta**: horas, ou dias com valor 1 → campo único “Data de execução” (horas persistem `end_date` nulo; 1 dia persiste `end_date = start_date`); dias com valor > 1 → “Data de início” + “Data de fim”, com validação igual à da proposta (dias corridos inclusivos **ou** dias úteis seg–sex iguais a `duration_value`). O slot proposto embute `duration_unit` e `duration_value`; no aceite, a duração do serviço contratado é atualizada. Backend: `_cns_validate_reschedule_slot`, `_cns_apply_service_reschedule_slot`. Detalhe: `docs/business/modulos/service-reschedule/features/propor-nova-data.md`.

---

### Etapa 5 — Cliente recebe solicitação

O cliente recebe um card dentro do chat.

Exemplo:

Nova Data Proposta

Data: 20/11
Turno: Manhã

[ Aceitar ]
[ Solicitar Ajuste ]

---

### Etapa 6 — Cliente aceita

Após a aceitação:

* O agendamento é atualizado.
* Todos recebem confirmação.
* O status volta para "Agendado".

---

## Regra de Segurança

Enquanto uma nova data não for formalmente aceita:

* A data original continua válida.

Isso evita:

* Mal-entendidos.
* Ausências.
* Divergências sobre qual data está valendo.

---

## SLA de Resposta

Ao solicitar um reagendamento:

* O prestador recebe notificações.
* O sistema acompanha a pendência.

Caso não haja resposta:

* Novos lembretes são enviados.

Mesmo assim:

* A data original continua vigente.

---

# Sistema de Cancelamento

## Objetivo

Permitir que o cliente encerre a contratação quando não desejar mais a execução do serviço.

---

## Regra Principal

O cancelamento pode ser realizado a qualquer momento.

Não existe prazo limite para cancelar.

---

## Motivo da Regra

Impedir cancelamentos não resolve o problema operacional.

Um cliente que não deseja mais o serviço pode:

* Não atender o prestador.
* Não estar presente.
* Gerar uma experiência negativa para ambas as partes.

É melhor permitir o cancelamento explícito do que incentivar ausências.

---

# Regras por Antecedência

## Cancelamento com mais de 48 horas

Situação:

* Cobrança ainda não realizada.

Consequências:

* Cancelamento imediato.
* Nenhum valor cobrado.
* Sem penalidades.

Status:

"Cancelado pelo Cliente"

---

## Cancelamento entre 48 e 24 horas

Situação:

* Cobrança pode já ter sido realizada.

Consequências:

* Cancelamento permitido.
* Evento registrado no histórico do cliente.

Status:

"Cancelado pelo Cliente"

---

## Cancelamento com menos de 24 horas

Situação:

* Cancelamento de última hora.

Consequências:

* Cancelamento permitido.
* Registro especial no histórico.

Status:

"Cancelado pelo Cliente (Última Hora)"

---

# Política Financeira Inicial

## Antes da cobrança

Se o cancelamento ocorrer antes das 48 horas:

* Nenhuma cobrança é realizada.

---

## Após a cobrança

Se o cancelamento ocorrer depois da cobrança:

* O valor é estornado integralmente ao cliente.

Objetivo:

* Simplificar a operação.
* Evitar conflitos.
* Reduzir atritos jurídicos.

Políticas mais sofisticadas poderão ser implementadas futuramente.

---

# Ausência do Cliente (No-Show)

Situação:

* Prestador comparece.
* Cliente não está presente.
* Serviço não pode ser executado.

Status:

"Cliente Ausente"

---

## Importância

Ausência é diferente de cancelamento.

O cliente teve oportunidade de cancelar e não cancelou.

Por isso:

* O evento deve ser registrado separadamente.
* O histórico do cliente deve considerar essa ocorrência.

---

# Histórico de Confiabilidade

A Renovi manterá um histórico interno de comportamento dos clientes.

Indicadores possíveis:

* Serviços concluídos.
* Reagendamentos.
* Cancelamentos.
* Cancelamentos de última hora.
* Ausências.

---

## Objetivo

Permitir que a plataforma:

* Identifique comportamentos abusivos.
* Crie regras futuras de proteção.
* Aumente a confiança dos prestadores.

---

# Status do Serviço

## Fluxo Principal

* Aberto
* Em Negociação
* Proposta Enviada
* Agendado
* Pagamento Pendente
* Pago
* Em Execução
* Concluído

---

## Fluxo de Reagendamento

* Reagendamento Solicitado
* Nova Data Proposta
* Agendado

---

## Fluxo de Cancelamento

* Cancelado pelo Cliente
* Cancelado pelo Cliente (Última Hora)
* Cancelado por Falta de Pagamento
* Cancelado pelo Prestador

---

## Fluxo de Ocorrências

* Cliente Ausente

---

# Atualizações Necessárias nos Termos de Uso

## Reagendamento

* O cliente poderá solicitar o reagendamento do serviço até 48 horas antes da data agendada.
* O reagendamento depende de acordo entre cliente e prestador.
* A nova data somente será considerada válida após formalização e aceitação pela plataforma.
* Enquanto a alteração não for aceita, a data original permanece válida.

---

## Cancelamento

* O cliente poderá cancelar o serviço a qualquer momento.
* Cancelamentos realizados após a cobrança poderão gerar processamento de estorno.
* Cancelamentos realizados com menos de 24 horas de antecedência serão registrados como cancelamentos de última hora.

---

## Ausência

* Caso o cliente não esteja disponível para a execução do serviço na data e período acordados, a ocorrência poderá ser registrada como ausência do cliente.

---

## Histórico de Confiabilidade

* A Renovi poderá utilizar o histórico de reagendamentos, cancelamentos e ausências para aprimorar mecanismos de segurança, confiança e qualidade da plataforma.

---

# Sistema de Reagendamento pelo Prestador

## Objetivo

Permitir que o prestador solicite a alteração da data de execução de um serviço já confirmado quando houver necessidade operacional ou algum imprevisto.

---

## Regra Principal

O prestador poderá solicitar o reagendamento do serviço a qualquer momento.

---

## Motivo da Regra

Imprevistos podem ocorrer mesmo próximos da data de execução, incluindo:

* Problemas de saúde.
* Emergências pessoais.
* Condições climáticas.
* Falta de materiais.
* Problemas logísticos.

Impedir o reagendamento não elimina o problema operacional e pode gerar ausências e experiências negativas para o cliente.

---

## Fluxo de Reagendamento

### Etapa 1 — Prestador solicita reagendamento

O prestador acessa o serviço e clica em:

"Solicitar Reagendamento"

---

### Etapa 2 — Sistema cria registro formal

O sistema:

* Altera o status para "Reagendamento Solicitado pelo Prestador".
* Insere uma mensagem automática no chat.

Exemplo:

"Carlos solicitou o reagendamento deste serviço. Converse pelo chat para definir uma nova data."

---

### Etapa 3 — Negociação pelo chat

Cliente e prestador negociam livremente uma nova data.

---

### Etapa 4 — Formalização da nova data

Após chegarem a um acordo:

O prestador envia uma atualização de agendamento contendo:

* Tempo estimado para executar e unidade (pré-preenchidos do contrato; editáveis).
* Nova data (ou período, conforme a duração informada).
* Novo turno.

---

### Etapa 5 — Cliente recebe solicitação

O cliente recebe um card para aprovar a alteração.

---

### Etapa 6 — Cliente aceita

Após a aceitação:

* A nova data passa a valer oficialmente.
* O status volta para "Agendado".

---

## Regra de Segurança

Enquanto uma nova data não for formalmente aceita:

* A data original continua válida.

---

## Reagendamentos Próximos da Data

Reagendamentos solicitados pelo prestador com menos de 24 horas de antecedência deverão ser registrados no histórico de confiabilidade como:

"Reagendamento de Última Hora"

---

# Sistema de Cancelamento pelo Prestador

## Objetivo

Permitir que o prestador encerre sua participação em um serviço quando não puder executá-lo.

---

## Regra Principal

O prestador poderá cancelar um serviço a qualquer momento.

---

## Fluxo de Cancelamento

### Etapa 1 — Prestador solicita cancelamento

O prestador acessa o serviço e clica em:

"Cancelar Serviço"

---

### Etapa 2 — Sistema solicita motivo

Exemplos:

* Problema de saúde.
* Emergência pessoal.
* Conflito de agenda.
* Impossibilidade técnica.
* Outro.

---

### Etapa 3 — Cancelamento é registrado

O sistema:

* Registra o cancelamento no histórico do prestador.
* Registra a antecedência do cancelamento.
* Notifica o cliente.

---

### Etapa 4 — Serviço retorna ao marketplace

Após o cancelamento do prestador:

* O vínculo entre cliente e prestador é encerrado.
* O serviço volta automaticamente para o status "Aberto".
* O pedido volta a ser exibido para outros prestadores.
* Novas propostas podem ser enviadas.
* O cliente não precisa criar um novo pedido.

---

## Objetivo da Reabertura Automática

Garantir que o cliente não precise reiniciar todo o processo caso um prestador desista da execução do serviço.

A plataforma assume a responsabilidade de recolocar o serviço no marketplace para que outros prestadores possam se candidatar.

---

## Tratamento Financeiro

Caso a cobrança já tenha sido realizada:

* O valor é estornado integralmente ao cliente.
* Nenhuma cobrança permanece vinculada ao prestador que cancelou.

Quando um novo prestador for contratado:

* Uma nova cobrança será realizada conforme as regras vigentes da plataforma.

---

## Cancelamentos Próximos da Data

Cancelamentos realizados pelo prestador com menos de 24 horas de antecedência deverão ser registrados como:

"Cancelamento pelo Prestador (Última Hora)"

---

# Histórico de Confiabilidade

A Renovi manterá um histórico interno de comportamento tanto para clientes quanto para prestadores.

## Indicadores dos Clientes

* Serviços concluídos.
* Reagendamentos solicitados.
* Cancelamentos.
* Cancelamentos de última hora.
* Ausências.

---

## Indicadores dos Prestadores

* Serviços concluídos.
* Reagendamentos solicitados.
* Reagendamentos de última hora.
* Cancelamentos.
* Cancelamentos de última hora.
* Taxa de conclusão dos serviços.
* Ausências registradas.

---

## Objetivo

Permitir que a plataforma:

* Identifique comportamentos abusivos.
* Crie regras futuras de proteção.
* Aumente a confiança entre clientes e prestadores.
* Avalie a confiabilidade operacional dos prestadores.

---

# Atualização dos Status do Serviço

## Fluxo Principal

* Aberto
* Em Negociação
* Proposta Enviada
* Agendado
* Pagamento Pendente
* Pago
* Em Execução
* Concluído

---

## Fluxo de Reagendamento

* Reagendamento Solicitado pelo Cliente
* Reagendamento Solicitado pelo Prestador
* Nova Data Proposta
* Agendado

---

## Fluxo de Cancelamento

* Cancelado pelo Cliente
* Cancelado pelo Cliente (Última Hora)
* Cancelado pelo Prestador
* Cancelado pelo Prestador (Última Hora)
* Cancelado por Falta de Pagamento

---

## Fluxo de Reabertura

* Aberto (Reaberto após Cancelamento do Prestador)

---

# Atualizações Necessárias nos Termos de Uso

## Reagendamento pelo Prestador

* O prestador poderá solicitar o reagendamento do serviço a qualquer momento.
* O reagendamento depende de acordo entre cliente e prestador.
* A nova data somente será considerada válida após formalização e aceitação pela plataforma.
* Enquanto a alteração não for aceita, a data originalmente agendada permanecerá válida.

---

## Cancelamento pelo Prestador

* O prestador poderá cancelar um serviço a qualquer momento.
* Cancelamentos realizados pelo prestador serão registrados em seu histórico de confiabilidade.
* Cancelamentos realizados com menos de 24 horas de antecedência poderão ser classificados como cancelamentos de última hora.
* Quando um prestador cancelar um serviço, a Renovi poderá reabrir automaticamente o pedido para permitir que outros prestadores enviem propostas ao cliente.

---

## Histórico de Confiabilidade

* A Renovi poderá utilizar o histórico de cancelamentos, reagendamentos, ausências e taxa de conclusão dos serviços para aprimorar mecanismos de segurança, confiança e qualidade da plataforma.
