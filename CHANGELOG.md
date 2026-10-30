# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Mantenha um Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

## [Não publicado]

### Corrigido

- Celular: a barra inferior ganhou o botão "Mais", que abre um painel com Configurações, Equipe e Horários (para
  proprietário e admin), Meu perfil, Painel Super Admin e **Sair do sistema**. Antes não havia como sair pelo celular,
  e Equipe e Horários só eram acessíveis no computador.

## [1.0.0] - 2026-10-29

### Adicionado

- Versão base, que registra o estado em produção em `eliza.solasoftware.com.br`: agendamento multi-tenant com
  personalização por nicho (Keckleon), agenda com fechamento de horário, clientes com prontuário, serviços,
  financeiro (pagamentos, orçamentos, despesas), equipe com 4 papéis, lembretes por WhatsApp (Evolution),
  agendamento público em `/marcar`, demo guiada em `/demo/start`, API REST v1 por chave, API do Autoatendimento e
  API pública de catálogo.
- O histórico anterior a esta versão, por data, fica em `docs/CHANGELOG.md`.

[Não publicado]: https://github.com/sergioguimas/eliza/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sergioguimas/eliza/releases/tag/v1.0.0
