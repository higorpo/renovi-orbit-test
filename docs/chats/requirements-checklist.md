# Checklist Completo de Requisitos — Fluxo Conversacional Cliente ↔ Prestador da Prestway

# 1. Estrutura Geral do Fluxo

1. Deve existir um fluxo completo de negociação conversacional entre cliente e prestador dentro do service request.
2. O fluxo deve suportar múltiplos prestadores negociando simultaneamente com o cliente.
3. O sistema deve limitar a quantidade de chats operacionalmente ativos por service request.
4. Chats inativos não devem consumir slots operacionais ativos.
6. O fluxo deve suportar negociação antes do envio formal da proposta.
7. O fluxo deve separar claramente estados de chat, proposta e service request.
8. O sistema deve suportar encerramento automático e manual de negociações.
9. O sistema deve suportar reativação de chats previamente inativos.
10. O fluxo deve funcionar tanto em mobile quanto desktop mantendo consistência operacional.

---

# 2. Estrutura do Service Request

11. O service request deve possuir status operacionais explícitos.
12. O service request deve suportar os estados OPEN,COMPLETED e CANCELLED.
15. O sistema deve impedir novas negociações após o service request entrar em estado COMPLETED.
16. O sistema deve encerrar automaticamente negociações concorrentes quando uma proposta for aceita.
17. O service request deve suportar cancelamento manual pelo cliente.
18. O cancelamento do service request deve encerrar todos os chats e propostas relacionados.
19. O sistema deve registrar timestamps de criação, atualização, aceite e encerramento do service request.
20. O sistema deve registrar métricas operacionais relacionadas ao lifecycle do pedido.

---

# 3. Estrutura do Chat

21. Deve existir uma interface de chat em tempo real entre cliente e prestador.
22. O chat deve suportar mensagens de texto.
23. O chat deve suportar envio de imagens.
24. O chat deve suportar envio de múltiplas imagens.
25. O chat deve suportar mensagens de sistema.
27. O chat deve suportar os estados ACTIVE, INACTIVE e CLOSED.
28. Chats ACTIVE devem consumir slot operacional.
29. Chats INACTIVE não devem consumir slot operacional.
30. Chats CLOSED não devem permitir novas mensagens.
31. O sistema deve identificar ausência de reciprocidade entre as partes.
32. Chats devem virar INACTIVE após 24h sem reciprocidade.
33. O sistema deve liberar automaticamente slots quando chats virarem INACTIVE.
34. Chats INACTIVE devem permanecer visíveis no histórico.
35. Chats INACTIVE devem poder ser reativados a qualquer momento.
36. O envio de uma nova mensagem deve reativar automaticamente um chat INACTIVE.
37. A reativação não deve depender da existência de slots disponíveis.
39. O chat deve exibir timestamp da última interação.
40. O sistema deve exibir claramente quando um chat foi encerrado.
41. O chat deve suportar encerramento manual por cliente ou prestador.
42. O encerramento manual deve exigir confirmação explícita.
43. O encerramento manual deve impedir futuras reativações.
44. O sistema deve exibir motivo de encerramento.
45. O sistema deve suportar notificações de novas mensagens usando Message Dispatcher.
46. O sistema deve suportar estado unread/read.
47. O chat deve suportar loading state durante envio de mensagens.
48. O sistema deve suportar retry de mensagens falhadas.
49. O chat deve suportar paginação ou carregamento incremental do histórico.
50. O input do chat deve se adaptar corretamente à abertura do teclado mobile.

---

# 4. Limites Operacionais dos Chats

51. O sistema deve limitar a quantidade de chats ACTIVE simultâneos por service request.
52. O sistema deve calcular slots com base apenas em chats ACTIVE.
53. Chats INACTIVE não devem bloquear entrada de novos prestadores.
55. O sistema deve evitar criação de chats duplicados para o mesmo prestador.
56. O sistema deve impedir que um prestador inicie conversa após o pedido ser fechado.
57. O sistema deve impedir novos chats após aceite de proposta.
58. O sistema deve suportar reentrada operacional de prestadores previamente inativos.
59. O sistema deve registrar auditoria de abertura, inativação, reativação e encerramento de chats.
60. O sistema deve possuir proteção contra spam de mensagens.

---

# 5. Descoberta e Negociação Inicial

61. O fluxo deve permitir conversação livre antes da proposta.
62. O prestador deve conseguir entender escopo antes do envio da proposta.
63. O fluxo deve permitir alinhamento de disponibilidade entre cliente e prestador.
64. O sistema deve incentivar perguntas estruturadas no início da conversa.
65. O chat deve suportar compartilhamento contextual de detalhes do serviço.
66. O sistema deve preservar contexto da negociação ao longo das revisões.
67. O sistema deve suportar mensagens longas e multiline.
68. O sistema deve permitir anexos visuais relevantes para o orçamento.
69. O sistema deve suportar mensagens automáticas orientativas.
70. O sistema deve exibir indicadores de typing quando aplicável.

---

# 6. Estrutura da Proposta

71. Deve existir um componente estruturado de proposta formal (já existe hoje no código, precisa extrair para uma feature isolada /home/higor/Área de Trabalho/Prestway/orbit/src/features/provider-jobs/components/ProviderProposalComposerDialog.tsx).
72. O prestador deve conseguir criar proposta diretamente pelo chat (abrindo em uma nova tela/modal).
73. A proposta deve conter valor.
74. A proposta deve conter descrição de escopo.
75. A proposta deve conter prazo estimado.
76. A proposta deve conter datas disponíveis.
77. A proposta pode conter observações adicionais.
78. A proposta pode conter fotos.
79. O sistema deve suportar múltiplas datas sugeridas na proposta.
80. O sistema deve exibir visualmente cada data disponível.
81. A proposta deve possuir status explícito.
82. O sistema deve suportar os estados PENDING, ACCEPTED, REJECTED, EXPIRED, REVISION_REQUESTED, REVISED e REJECTED_AUTOMATICALLY.
83. O sistema deve registrar timestamps de envio e atualização da proposta.
84. O sistema deve impedir edição de proposta já enviada.
85. Revisões devem gerar novas versões da proposta.
86. O sistema deve preservar histórico completo de revisões.
87. O sistema deve exibir claramente qual proposta está vigente.
88. O sistema deve permitir comparação visual entre revisões anteriores.
89. O sistema deve suportar loading state durante envio de proposta.
90. O sistema deve suportar falha/retry no envio de proposta.

---

# 7. Fluxo de Aceite da Proposta

91. O cliente deve conseguir visualizar uma proposta diretamente pelo chat.
92. O aceite deve exigir seleção obrigatória de uma das datas disponíveis.
93. O aceite deve representar concordância simultânea de preço, escopo e data.
94. Não deve existir etapa posterior de confirmação bilateral.
95. O aceite deve transformar a proposta em ACCEPTED.
96. O aceite deve transformar o service request em CONCLUDED.
97. O aceite deve encerrar automaticamente todos os outros chats.
98. O aceite deve rejeitar automaticamente todas as outras propostas.
99. O sistema deve impedir múltiplos aceites simultâneos.
100. O sistema deve exibir confirmação antes do aceite definitivo.
101. O sistema deve exibir resumo completo da proposta antes da confirmação.
102. O sistema deve disparar notificações de fechamento para outros prestadores.
103. O sistema deve bloquear novas mensagens nos chats encerrados automaticamente.
104. O sistema deve registrar timestamp do aceite.
105. O sistema deve registrar data escolhida como data oficial do serviço.

---

# 8. Fluxo de Revisão da Proposta

106. O cliente deve conseguir solicitar revisão da proposta.
107. O pedido de revisão deve ser estruturado.
108. O sistema deve exibir motivos predefinidos para revisão.
109. O sistema deve suportar os motivos:

* preço muito alto
* reduzir escopo
* data não funciona
* alterar prazo
* esclarecer detalhes

110. O cliente deve conseguir adicionar observações customizadas.
111. Solicitação de novas datas deve ser tratada como revisão da proposta.
112. O sistema deve limitar revisões a no máximo 2 por negociação.
113. O limite deve considerar o contexto geral da negociação.
114. O sistema deve impedir novas revisões após o limite ser atingido.
115. Após atingir o limite, o cliente deve poder apenas aceitar, recusar ou encerrar.
116. O sistema deve exibir contador visual de revisões restantes.
117. O prestador deve poder aceitar ou recusar a solicitação de revisão.
118. O prestador deve conseguir enviar nova proposta revisada.
119. Cada revisão deve gerar nova versão de proposta.
120. A nova proposta deve substituir operacionalmente a anterior.
121. O sistema deve registrar histórico completo das revisões.
122. O sistema deve exibir visualmente que a proposta atual é revisada.
123. O sistema deve reiniciar SLA da proposta após revisão.

---

# 9. Expiração da Proposta

124. Propostas devem possuir SLA de resposta.
125. O cliente deve possuir tempo limitado para agir sobre a proposta.
126. O sistema deve expirar automaticamente propostas sem resposta.
127. Propostas expiradas devem assumir status EXPIRED.
128. A expiração da proposta não deve encerrar automaticamente o chat.
129. O sistema deve notificar cliente antes da expiração.
130. O sistema deve exibir countdown visual da validade da proposta.
131. O sistema deve registrar timestamp da expiração.
132. O prestador deve conseguir reenviar proposta após expiração.
133. O sistema deve impedir aceite de proposta expirada.
134. O sistema deve diferenciar visualmente propostas expiradas.

---

---

# 11. Estados Visuais e UX

148. O sistema deve exibir estados visuais claros para chats e propostas.
149. Chats ACTIVE devem possuir destaque visual.
150. Chats INACTIVE devem possuir indicação visual reduzida.
151. Chats CLOSED devem ser claramente identificados.
152. Propostas PENDING devem possuir CTA principal destacado.
153. Propostas ACCEPTED devem possuir estado visual de sucesso.
154. Propostas EXPIRED devem possuir estado visual desabilitado.
155. O sistema deve exibir badges de status.
156. O sistema deve exibir feedback visual imediato após ações críticas.
157. O sistema deve suportar estados loading/skeleton.
158. O sistema deve suportar empty states.
159. O sistema deve suportar error states.
160. O sistema deve exibir mensagens operacionais contextualizadas.
161. O sistema deve preservar hierarquia visual entre chat e proposta.
162. O sistema deve diferenciar claramente mensagens humanas e mensagens de sistema.

---

# 12. Responsividade

163. O fluxo completo deve funcionar em mobile e desktop.
164. O layout mobile deve priorizar conversação e CTAs.
165. O layout desktop deve suportar visão simultânea de chat e proposta.
166. O sistema deve adaptar corretamente componentes ao teclado virtual.
167. O sistema deve suportar scroll persistente em listas longas.
168. O sistema deve preservar contexto ao alternar entre chats.
169. O sistema deve suportar diferentes tamanhos de tela.
170. O sistema deve evitar overflow horizontal.
171. O sistema deve suportar orientação portrait e landscape em mobile.

---

# 13. Acessibilidade

172. Todos os CTAs devem possuir labels acessíveis.
173. O fluxo deve ser navegável por teclado.
174. O sistema deve suportar screen readers.
175. O contraste visual deve atender padrões WCAG.
176. Estados visuais não devem depender apenas de cor.
177. O sistema deve possuir foco visível nos elementos interativos.
178. O sistema deve anunciar mudanças críticas de estado.
179. O sistema deve suportar zoom sem quebra de layout.
180. O sistema deve possuir áreas de toque adequadas em mobile.

---

# 14. Observabilidade e Operação

181. O sistema deve registrar logs de todas as transições de estado.
182. O sistema deve registrar auditoria de ações críticas.
183. O sistema deve suportar analytics de conversão.
184. O sistema deve registrar tempo médio até primeira resposta.
185. O sistema deve registrar tempo médio até proposta.
186. O sistema deve registrar taxa de aceite.
187. O sistema deve registrar taxa de revisão.
188. O sistema deve registrar taxa de expiração.
189. O sistema deve registrar motivo de encerramentos.
190. O sistema deve permitir debugging operacional dos fluxos.
191. O sistema deve suportar replay operacional de eventos.
192. O sistema deve suportar monitoramento de SLAs.
