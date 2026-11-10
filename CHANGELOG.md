# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Mantenha um Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

## [Não publicado]

### Adicionado

- Agenda visível por número de dias, ajustável em Configurações → Preferências ("Agenda visível para clientes (dias)",
  de 0 a 365, padrão 60). Vale para o atendente automático (WhatsApp e chat) e para a página pública `/marcar`: a
  página desabilita no calendário as datas além do limite e recusa no servidor um envio forjado fora dele.
- Agenda fechada: com o valor 0, o atendente não consulta, marca nem remarca horário (a API responde
  `AGENDA_FECHADA`, HTTP 422), e a página `/marcar` mostra "Agenda online fechada no momento" no lugar do formulário
  e do chat. Cancelar e confirmar continuam funcionando. Painel e API v1 não mudam.
- Novo motivo `triagem` em `POST /autoatendimento/escalonamentos`, para o atendente avisar a equipe de um pedido de
  horário enquanto a agenda está fechada.
- A OpenAPI de Autoatendimento marca `consultarHorarios`, `criarAgendamento` e `remarcarAgendamento` com
  `x-atendente-agenda: true`, para o atendente saber quais ferramentas dependem da agenda aberta.
- Biblioteca de fotos no painel: envio de JPEG, PNG ou WebP com recorte 3:4. O servidor converte para WebP em duas
  larguras (960 e 480 px) e não guarda o arquivo original, então dados de localização da foto (GPS) são descartados.
  Só dona e admin enviam, editam e excluem fotos.
- Base para foto e ordem por categoria de serviço, e para a vitrine de destaques (foto, legenda e categoria por item).
  As telas do painel para isso chegam na próxima etapa.
- Catálogo público (`GET /api/public/v1/orgs/{slug}/catalogo`) passa a trazer `categorias` (ordem e foto de cada uma)
  e `vitrine` (destaques). São campos novos e aditivos: quem já lê o catálogo não precisa mudar nada.
- Seletor de fotos no painel: escolhe da biblioteca ou envia uma nova, com recorte 3:4 (zoom por pinça ou barra),
  descrição obrigatória e barra de progresso do envio. Dá para editar a descrição e excluir fotos que não estão em uso.

### Modificado

- `GET /autoatendimento/contexto`: `politica.janelaMaximaDias` agora pode ser `0` (agenda fechada) e passa a vir de
  Configurações, a mesma fonte da página `/marcar`.

### Obsoleto

- `autoatendimento_config.janela_maxima_dias` deixa de ser lida; a janela vem de
  `organization_settings.agenda_visivel_dias`. A coluna segue no banco e sai numa versão MAIOR.

## [1.3.0] - 2026-11-07

### Modificado

- Cadastro de cliente: o documento (CPF) deixa de ser obrigatório em todo lugar, e a data de nascimento passa a ser
  obrigatória onde o documento era (agendamento pelo painel, página pública `/marcar` e cadastro em Clientes). A API
  v1 e o atendente seguem sem exigir nenhum dos dois.
- Quando telefone e documento apontam para dois cadastros diferentes, a data de nascimento desempata: se só um deles
  nasceu nesse dia, o agendamento vai para ele em vez de recusar como cadastro ambíguo.
- Data de nascimento inválida (dia que não existe, antes de 1900 ou no futuro) é recusada com `VALIDATION_ERROR`
  em todos os canais, inclusive API v1 e Autoatendimento; antes ia para o banco e virava erro genérico ou era gravada.

### Corrigido

- Agendamento pelo painel com "+ Novo cliente" sempre falhava com "Nome, telefone e documento do paciente são
  obrigatórios.", porque o formulário não tinha campo de documento. Agora ele pede data de nascimento e documento
  (opcional), e a mensagem não fala mais em "paciente".

## [1.2.0] - 2026-11-04

### Adicionado

- Chat na página pública de agendamento: o cliente conversa, tira dúvidas sobre serviços e horários, e o atendente
  preenche o formulário. Quem confirma é sempre o cliente, no "Agendar agora"; o chat nunca grava nada. Ligado por org
  pela coluna `autoatendimento_config.canal_web`, desligado por padrão. Migration
  `20261104130000_autoatendimento_canal_web`. A API de Autoatendimento passa a aceitar o ticket de visitante em
  contexto, serviços, profissionais e horários, sem mudar a versão do contrato.
- API v1: `POST /api/v1/appointments` aceita `addons` (opcional), com só `id` e `quantity` de cada adicional do
  serviço; o Eliza copia nome e valor do catálogo e grava em `price` o total (serviço mais adicionais). `GET`
  e as respostas de escrita passam a devolver `addons` (`id`, `name`, `unit_price`, `unit`, `quantity`, `total`),
  sempre presente e `[]` quando não há. Sem o campo, nada muda. Adicional que não é do serviço, repetido ou com
  quantidade fora de 1 a 20, ou campo de valor no item, responde `422 VALIDATION_ERROR`.
- Autoatendimento: `POST /agendamentos` aceita `adicionais` (opcional, `id` e `quantidade`), e todo
  `AgendamentoResumo` (criação, listagem e contexto) traz `adicionais` e `valorTotal`, o total calculado pelo
  Eliza. O atendente passa a poder incluir adicionais no agendamento e deve apresentar o total como estimado.
  A versão do contrato continua `1`: tudo é aditivo. Remarcar mantém adicionais e valor, e pedido repetido
  devolve o agendamento já criado sem somar de novo.

## [1.1.0] - 2026-11-03

### Adicionado

- Treino do atendente: em Configurações, na aba WhatsApp, o dono ou admin abre a página "Treinar atendente", responde a
  ensaios em que o atendente faz o papel de cliente e acompanha o que ele aprendeu, com versões, remoção de padrões e
  notas de fatos do negócio. Requer `ATENDENTE_TREINO_SECRET`; sem ela, a página avisa que não está disponível. O que é
  aprendido ainda não muda as respostas aos clientes.
- Serviços: adicionais opcionais, com nome, valor e unidade (ex.: "Unha quebrada", R$ 5 por unha), cadastrados no
  formulário do serviço e mostrados no card. Cada adicional tem um `id` estável, que não muda ao editar o serviço.
  Consultáveis em `GET /api/v1/services` (`addons`), no Autoatendimento (`adicionais`) e no catálogo público
  (`adicionais`), sempre presentes e `[]` quando não há; em todos eles cada item agora traz `id`. Migrations
  `20261103190000_services_addons` (coluna `services.addons`) e `20261104120000_appointments_addons` (`id` em cada
  adicional já cadastrado e a coluna `appointments.addons`), já aplicadas no banco.
- Agendamento com adicionais: na página pública de agendamento (`/marcar`) a cliente escolhe os adicionais do
  serviço, com quantidade (de 0 a 20 quando o valor é por unidade, como "por unha"), e vê o **total estimado**,
  seguido de "O valor final é confirmado no atendimento". No painel, o novo agendamento também permite escolher os
  adicionais. O valor do agendamento passa a ser o do serviço mais os adicionais, calculado no servidor a partir do
  catálogo: valor enviado pelo navegador nunca é aceito. O agendamento guarda uma cópia do que foi escolhido, então
  mudar ou apagar um adicional no catálogo não altera agendamento já feito.
- Painel: "Ajustar adicionais" no menu do agendamento (card e clique direito) corrige a quantidade real durante ou
  depois do atendimento, até o pagamento ser registrado, inclusive em agendamento chegou ou finalizado. Agendamento
  pago ou estornado, cancelado ou com falta não oferece o ajuste. O ajuste recalcula o valor, aparece no histórico e
  não avisa a cliente pelo WhatsApp. Os adicionais escolhidos aparecem nos cards do painel inicial e da ficha do cliente.
- Cor do sistema por organização: em Configurações, o proprietário ou admin escolhe entre a cor padrão do nicho e as
  paletas Grafite, Sálvia e Areia, aplicadas no painel e na página de agendamento (`/marcar`). Todas as paletas têm
  versão clara e escura com contraste conferido. Migration `20261103120000_organizations_brand_palette` (coluna
  `organizations.brand_palette`, já aplicada no banco).

### Corrigido

- Trocar o serviço de um agendamento agora recalcula o valor: `price` passa a ser o do novo serviço e os adicionais
  escolhidos são removidos (o painel avisa antes de salvar). Antes o valor do serviço antigo ficava gravado em
  silêncio e seguia para o financeiro. Agendamento já pago ou estornado recusa a troca ("desfaça o pagamento").
  Vale também para `PATCH /api/v1/appointments/{id}`, cujo `price` passa a acompanhar o serviço.
- WhatsApp: ao aprovar um pedido pendente, confirmar um agendamento pela API ou recusar um pedido, o cliente agora
  recebe o modelo configurado em Configurações → Mensagens ("Ao confirmar agendamento" e "Ao cancelar"). Antes esses
  envios ignoravam o modelo da organização e usavam um texto fixo do sistema, que continua valendo só para quem não
  configurou o modelo.

## [1.0.1] - 2026-10-30

### Corrigido

- Celular: a barra inferior ganhou o botão "Mais", que abre um painel com Configurações, Equipe e Horários (para
  proprietário e admin), Meu perfil, Painel Super Admin e **Sair do sistema**. Antes não havia como sair pelo celular,
  e Equipe e Horários só eram acessíveis no computador.
- Recuperação de senha: o link do e-mail passa a funcionar aberto em qualquer aparelho ou navegador (antes só
  funcionava no mesmo navegador que pediu a recuperação; nos outros, voltava para a tela de pedir o e-mail).
  **Exige trocar o template "Reset Password" no Supabase** — ver `docs/AUTH_E_RECUPERACAO.md`.
- Link de recuperação expirado, já usado ou substituído por um pedido mais novo agora mostra um aviso explicando o
  motivo, em vez de abrir o formulário de e-mail sem explicação.

### Segurança

- Links de e-mail (recuperação e primeiro acesso) não aceitam mais um destino `next` com barra invertida, que o
  navegador interpretava como outro domínio e permitia redirecionar a pessoa para fora do Eliza.

## [1.0.0] - 2026-10-29

### Adicionado

- Versão base, que registra o estado em produção em `eliza.solasoftware.com.br`: agendamento multi-tenant com
  personalização por nicho (Keckleon), agenda com fechamento de horário, clientes com prontuário, serviços,
  financeiro (pagamentos, orçamentos, despesas), equipe com 4 papéis, lembretes por WhatsApp (Evolution),
  agendamento público em `/marcar`, demo guiada em `/demo/start`, API REST v1 por chave, API do Autoatendimento e
  API pública de catálogo.
- O histórico anterior a esta versão, por data, fica em `docs/CHANGELOG.md`.

[Não publicado]: https://github.com/sergioguimas/eliza/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/sergioguimas/eliza/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/sergioguimas/eliza/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/sergioguimas/eliza/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/sergioguimas/eliza/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/sergioguimas/eliza/releases/tag/v1.0.0
