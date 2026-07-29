- Precisamos optar pelo regime de caixa para declaração de imposto de renda


Itens interessantes de ter na plataforma (futuro)

- Prestador poder adicionar um contato que ele já fez serviço para ser verificado na plataforma
- Forma de validar que o prestador é indicado para mulheres também
- Precisa permitir alterar valor combinado, adicionar itens extras, cliente aprova etc
- Usar IA pra ela criar novas perguntas baseado em tudo o que o cliente respondeu para que ele responda em caso de ter ficado alguma coisa em aberto, alguma coisa que o prestador teria que saber
- Colocar a IA pra sugerir fotos pra ele tirar que seriam interessantes pro prestador entender melhor o problema
- Poder denunciar pedidos de orçamento feitos na plataforma por infringir as regras
- Poder denunciar clientes
- Poder denunciar prestadores
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
- Deixar página de erro mais bonita
- Adicionar no chat tanto do prestador  quanto do cliente ações rápidas para um serviço em estado de em andamento
  - Poder cancelar o serviço
  - Poder reagendar o serviço
  - Ver informações do serviço


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
- Como eu garanto que alterações feitas em tabelas/rpcs não quebram versões  anteriores do app?



Telas/fluxos restantes:

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
- Weblab
- Template dos emails
- Refazer tela de erros
- Refazer tela de minha conta
- Como vai funcionar a emissão de nota fiscal da plataforma?
- Nova tela de minha conta

Coisas para verificar:

- Prestadores marcados como "Pioneiros" tem taxa de serviço menor
- Direcionar prestador para que ele cadastre serviços que ele atenda para exibir trabalhos
- Estrelas de avaliação dos cards devem estar usando dados reais
- Verificar como estamos fazendo upload de arquivos hoje na plataforma. Precisamos usar pre-signed urls e não passar nada pelo servidor/EFs. Também precisamos eliminar arquivos órfãos.
- Verificar se devemos usar ULID a o invés de UUID


Coisas para terminar do fluxo atual de trabalho:

- ao gerar a descrição do pedido, também gerar o checklist de conclusão do serviço
  - mostrar o checklist de conclusão do serviço pro prestador na hora que ele vai fazer o orçamento e permitir que ele altere alguma coisa
  - apresentar o checklist de conclusão do serviço para o cliente quando ele vai fechar o serviço






Coisas para fazer next
-[avaliar]simplificar query de get_service_list  (hoje ele tá trazendo um monte de dados que nem vai ser exibido no card)
-fluxo de prestador recusar revisão de proposta

- Verificar se todos os locais onde tenho carregando de mais páginas no sistema estão usando cursor de forma performática.


- fazer um checkup geral do banco de dados para RLS e CLS


- na tela de minha conta do cliente, precisa colocar skeleton para as informações relacionadas a pagamentos


- verificar para o endereço: definir o tipo de endereço, se é casa ou apto ou algum outro tipo e permitir adicionar detalhes de interfone por exemplo. precisamos garantir que o prestador saiba como entrar em contato com o cliente.


- payment_cron_post_sentry_alerts e payment-emite-sentry-alerts talvez poderiam ser algo compartilhado e não exclusivo de payments

- verificar se o e-mail de onboarding está sendo enviado para netcred 







Fluxo de pagamentos, itens com problemas:
- A tela de "credenciamento de pagamentos" do prestador não está com um design bom
- A tela de "credenciamento de pagamentos" não aparece quando eu navego para meus servoços ou trabalhos como algo obrigatório
- Verificar se depois que eu preenchi os detalhes do credencimento do prestador se aparece as telas com os status correspondentes.
- Não está funcionamento o credenciamento de pagamentos, os dados não são enviados. Além disso há um problema que ele faz o upload dos documentos a  cada envio, deveria enviar tudo junto e fazer na própria edge function. Tela também naõ é amigável em relação ao número do banco.








- Fluxo de estorno de dinheiro em caso do serviço agendado não ser  prestado para o cliente.





- É permitido fazer reagendamento de serviços  para muito longe (por exemplo +30 dias a frente). O prestador pode pedir reagendamento sem teto mínimo,o cliente pode pedir reagendamento até 48hrs antes, em tese o pagamento ainda naõ estaria capturado, mas tem chance. Como o prestador pode pedir faltando 4hrs por exemplo, o pagamento já poderia estar capturado, nesse caso teríamos que fazer uma lógica para remembolsar o valor e fazer a captura novamente em data futura caso a data do pedido fosse para muito mais a frente para evitar cair na liquidação automática.








- Mostrar liquidações para o prestador




- /home/higor/Área de Trabalho/Renovi/orbit/src/features/payments/api/serviceLifecycle.api.ts não deveria estar dentro de payments. Ele faz parte do fluxo de conclusão de um serviço, então deveria estar na feature de acordo


- [RETESTAR TODO O FLUXO] Erro de fluxo ao solicitar reembolso documentado em docs/payment-system/critical-bug-refund-partial-commit.md


---




Detalhes dos testes:
Cartão aprovado: 4970100000000048
Cartão rejeitado: 4970100000000071

10/2027
123
Maria da Silva
504.432.630-51

CPF/CNPJ terminando em 1 → aprovação
CPF/CNPJ terminando em outro dígito → rejeição




----
