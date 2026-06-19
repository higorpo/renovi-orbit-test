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

### Etapa 1 — Cliente solicita reagendamento

O cliente acessa o serviço e clica em:

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

O prestador clica em:

"Atualizar Agendamento"

Informando:

* Nova data.
* Novo turno.

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
