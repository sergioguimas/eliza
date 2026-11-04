# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Mantenha um Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

## [Não publicado]

### Adicionado

- Treino do atendente: em Configurações, na aba WhatsApp, o dono ou admin abre a página "Treinar atendente", responde a
  ensaios em que o atendente faz o papel de cliente e acompanha o que ele aprendeu, com versões, remoção de padrões e
  notas de fatos do negócio. Requer `ATENDENTE_TREINO_SECRET`; sem ela, a página avisa que não está disponível. O que é
  aprendido ainda não muda as respostas aos clientes.
- Serviços: adicionais opcionais, com nome, valor e unidade (ex.: "Unha quebrada", R$ 5 por unha), cadastrados no
  formulário do serviço e mostrados no card. Só informam o cliente: não entram no preço do agendamento. Consultáveis
  em `GET /api/v1/services` (`addons`), no Autoatendimento (`adicionais`) e no catálogo público (`adicionais`), sempre
  presentes e `[]` quando não há. Migration `20261103190000_services_addons` (coluna `services.addons`, já aplicada
  no banco).
- Cor do sistema por organização: em Configurações, o proprietário ou admin escolhe entre a cor padrão do nicho e as
  paletas Grafite, Sálvia e Areia, aplicadas no painel e na página de agendamento (`/marcar`). Todas as paletas têm
  versão clara e escura com contraste conferido. Migration `20261103120000_organizations_brand_palette` (coluna
  `organizations.brand_palette`, já aplicada no banco).

### Corrigido

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

[Não publicado]: https://github.com/sergioguimas/eliza/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/sergioguimas/eliza/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/sergioguimas/eliza/releases/tag/v1.0.0
