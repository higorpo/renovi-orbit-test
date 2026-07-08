home services app that lists local vendors app

Itens interessantes de ter na plataforma (futuro)

- Prestador poder adicionar um contato que ele já fez serviço para ser verificado na plataforma
- Forma de validar que o prestador é indicado para mulheres também
- Precisa permitir alterar valor combinado, adicionar itens extras, cliente aprova etc
- Usar IA pra ela criar novas perguntas baseado em tudo o que o cliente respondeu para que ele responda em caso de ter ficado alguma coisa em aberto, alguma coisa que o prestador teria que saber
- Colocar a IA pra sugerir fotos pra ele tirar que seriam interessantes pro prestador entender melhor o problema
- Poder denunciar pedidos de orçamento feitos na plataforma por infringir as regras
- Criar mecanismo de descontos de taxas, onde a gente pode definir a % de desconto em cima da taxa original, título e descrição para o desconto e a data de início e fim que o desconto pode ser aplicado
- Usar IA para sugerir datas pro profissional na hora de montar o orçamento dele
- Usar IA para melhorar a descrição do orçamento do profissional
- Refatorar os uploads de imagens para ser mais compartilhado
- Verificar se é possível colocar caching de mutations para caso o usuário esteja sem internet isso ser enviado/sincronizado depois
- Quando enviar proposta ou entrar para ver detalhes de um pedido fora da área, perguntar ao prestador se ele quer adicionar aquela área
- Sistema de badges dos cards das telas de meus serviços e orçamentos para o cliente e prestador deveria ser unificado para manter consistência. Podemos unificar também o card de serviço para manter melhor consistência.
-mostrar contador de quantidade de chats não lidos no bottom navigator
- Adicionar integração com IA que avalia a melhor proposta e faz um resumo
- Exibir sugestões de perguntas para o prestador na hora que ele abre o chat pela primeira vez
-ver imagens que o chat gpt gerou da tela de detalhes do serviço e o que podemos incorporar de fato.
- Permitir se inscrever em um tópico no FCM



Urgentes:

- Está dando erro para enviar imagens mesmo elas não tendo conteúdo errado na tela de criação  de pedido
- Renomear todas as rotas para ingles para manter consistência
- Tela de onboarding do prestador, onde ele selecione as áreas de atuação e os serviços que ele faz, além de outras opções (verificação do perfil)
- Há um problema com a captura de localização no formato atual. Ele está trazendo localização errada no PC, tem que checar se no Windows está assim também.
- Adicionar google analytics em todos os fluxos
- Sistema de verificação de perfil do prestador, onde ele anexa os documentos e a equipe interna avalia
- remoteconfig para não permitir cadastrar profissionais etc
- remoteconfig para redirecionar para grupo de whatsapp
-cadastro e criação de service requests não estão funcionando por conta da proteção 
- Adicionar no chat botão para envio de proposta que fica visível a todo momento
- Ver vídeo no Youtube sobre a questão que eu estou usando para precificação exibida para o prestador/cliente, pois parece que há um problema de segurança: https://www.youtube.com/watch?v=rTXy2p9aAVw&list=WL&index=75&t=601s&pp=iAQBsAgC.

Telas/fluxos restantes:

- Pagamento de um serviço
- Visualização de detalhes de um serviço em execução
- Visualizar checklist de conclusão do serviço
- Avaliação do serviço após sua conclusão
- Tela de perfil do prestador
- Prestador poder vender para clientes de fora da plataforma
- Sistema de disputas
- Tela de notificação
- Mesmo com cadastro manual precisa fazer aceite dos termos de uso
- Todo o painel administrativo
- Tela de onboarding para prestador
- Tela de onboarding para cliente
- Fluxo do prestador/cliente remarcar um serviço
- Fluxo do prestador/cliente cancelar um serviço
- Weblab
- Template dos emails
- Refazer tela de erros

Coisas para verificar:

- Prestadores marcados como "Pioneiros" tem taxa de serviço menor
- Direcionar prestador para que ele cadastre serviços que ele atenda para exibir trabalhos
- Estrelas de avaliação dos cards devem estar usando dados reais


Coisas para terminar do fluxo atual de trabalho:

- ao gerar a descrição do pedido, também gerar o checklist de conclusão do serviço
  - mostrar o checklist de conclusão do serviço pro prestador na hora que ele vai fazer o orçamento e permitir que ele altere alguma coisa
  - apresentar o checklist de conclusão do serviço para o cliente quando ele vai fechar o serviço


Coisas para fazer next
-renomear tabela de provider_proposals
-[avaliar]simplificar query de get_service_list  (hoje ele tá trazendo um monte de dados que nem vai ser exibido no card)
-fluxo de prestador recusar revisão de proposta

- Verificar se todos os locais onde tenho carregando de mais páginas no sistema estão usando cursor de forma performática.


- fazer um checkup geral do banco de dados para RLS e CLS


- na tela de minha conta do cliente, precisa colocar skeleton para as informações relacionadas a pagamentos

- process-refund EF também ser a que faz o cancelamento do serviço. renomear ela.

- verificar para o endereço: definir o tipo de endereço, se é casa ou apto ou algum outro tipo e permitir adicionar detalhes de interfone por exemplo. precisamos garantir que o prestador saiba como entrar em contato com o cliente.


- payment_cron_post_sentry_alerts e payment-emite-sentry-alerts talvez poderiam ser algo compartilhado e não exclusivo de payments

- verificar se o e-mail de onboarding está sendo enviado para netcred 

- no chat ele faz um platform_constant_int para obter o SLA do chat, faz sentido isso? é seguro? verificar em outros lugares que estamos chamando platform constants. porque talvez não faça sentido em termos de segurança


Fluxo de pagamentos, itens com problemas:
- A tela de "credenciamento de pagamentos" do prestador não está com um design bom
- A tela de "credenciamento de pagamentos" não aparece quando eu navego para meus servoços ou trabalhos como algo obrigatório
- Verificar se depois que eu preenchi os detalhes do credencimento do prestador se aparece as telas com os status correspondentes.
- Não está funcionamento o credenciamento de pagamentos, os dados não são enviados. Além disso há um problema que ele faz o upload dos documentos a  cada envio, deveria enviar tudo junto e fazer na própria edge function. Tela também naõ é amigável em relação ao número do banco.


- Forma que ele abre a dialog de pagamento naõ está boa
- Precisamos coletar o CPF do títular do cartão de crédito e garantir que ele é o mesmo do dono da conta.
- O frontend está mostrando erros que vem do backend sem muito tratamento na dialog de pagamento.




- Na tela de detalhes de um serviço, com serviço contratado aparece uma box "servico contratado" com informações como status CONFIRMED sem tratamento e data de agendamento também sem tratamento correto.

- Na tela de meus serviços melhorar a visualização de que um pedido ainda está aguardando pagamento.

- Na tela de histórico de pagamento do cliente mostrar reembolso parcial (valor)

- Como vai funcionar a emissão de nota fiscal da plataforma?

- Verificar: um CNPJ pode agendar vários serviços para o mesmo dia?

- Fluxo de estorno de dinheiro em caso do serviço agendado não ser  prestado para o cliente.

- Ao reagendar um serviço, mesagem que mostra no chat "Maria da Silva solicitou o reagendamento do serviço agendado para 17/07/2026 (Dia inteiro). Não vou estar disponível nesse dia" não deixa claro o que é mensagem do sistema e o que é mensagem enviada pelo cliente/prestador.

- Dialog de propor nova data para o prestador deve aparecer em tela cheia

- Acho que temos que desativar a window de push que  hoje tá em 20 minutos.

- Quando eu faço a solicitação de reagendamento do serviço pela tela de detalhes do serviço, a dialog pisca na tela ao apertar no botão para enviar a solicitação

- Dúvida: O que acontece se eu  tentar aceitar uma data agendada que já passou?

- Dúvida: O que acontece se o cliente não aceitar a data ou o prestador não enviar a data de agendamento e chegar a data de execução do serviço?

- Está aparecendo botão  "Cancelar solicitação" para o prestador quando ele vai propor uma nova data


- Alterar layout de alertdialog no mobile para ele não ocupar lateralmente toda a tela e ter cantos arredondados.

- Não permitir na dialog de propor proposta que o prestador defina como dias mas coloque que só vai levar um dia. Deve ser horas daí.

- Permitir prestador de serviço reagendar serviço não pago ainda.

- É permitido fazer reagendamento de serviços  para muito longe (por exemplo +30 dias a frente). O prestador pode pedir reagendamento sem teto mínimo,o cliente pode pedir reagendamento até 48hrs antes, em tese o pagamento ainda naõ estaria capturado, mas tem chance. Como o prestador pode pedir faltando 4hrs por exemplo, o pagamento já poderia estar capturado, nesse caso teríamos que fazer uma lógica para remembolsar o valor e fazer a captura novamente em data futura caso a data do pedido fosse para muito mais a frente para evitar cair na liquidação automática.

Detalhes dos testes:
4970100000000048
10/2027
123
Maria da Silva





----
