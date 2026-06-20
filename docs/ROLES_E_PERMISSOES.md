# Roles e Permissões

## Roles

### `owner`

Proprietário da organização.

- Pode gerenciar configuração da organização.
- Pode gerenciar equipe.
- Pode alterar hierarquia de membros.
- Não deve ser removido pela tela de equipe.

### `admin`

Administrador operacional.

- Pode gerenciar membros com restrições.
- Não pode remover outro `admin`.
- Não pode alterar `owner`.
- Ao virar `admin`, deve existir registro ativo em `professionals`.

### `professional`

Profissional atendente.

- Pode aparecer na agenda.
- Deve ter registro ativo em `professionals`.
- Pode ter disponibilidade em `professional_availability`.

### `staff`

Equipe de apoio.

- Acesso operacional limitado.
- Normalmente não aparece como profissional na agenda.
- Ao virar `staff`, o registro em `professionals` deve ser desativado.

## Relação `profiles` x `professionals`

`profiles`:

- autenticação;
- organização;
- role;
- dados básicos do usuário.

`professionals`:

- agenda;
- disponibilidade;
- dados profissionais;
- vínculo opcional com usuário via `user_id`.

Não inserir `role` em `professionals`.

## Remoção de Membros

Regras esperadas:

- `owner` não pode ser removido.
- usuário não pode remover a si mesmo.
- `admin` não pode remover outro `admin`.
- membro precisa pertencer à mesma organização.
- remover membro deve limpar `profiles.organization_id` e desativar `professionals`.

## Alteração de Hierarquia

Regras esperadas:

- `owner` pode alterar membros que não sejam `owner`;
- `admin` pode alterar membros que não sejam `owner` ou `admin`;
- usuário não pode alterar a própria permissão;
- ao mudar para `professional` ou `admin`, ativar/criar registro em `professionals`;
- ao mudar para `staff`, desativar registro em `professionals`.

## Arquivos

- `web/app/actions/team-members.ts`
- `web/components/settings/team-member-actions.tsx`
- `web/app/(app)/configuracoes/equipe/page.tsx`

## Cuidados

- `profile.organization_id` pode ser `string | null`; validar antes de usar.
- Garantir que updates filtram por `organization_id`.
- Não vazar dados de outra organização.

