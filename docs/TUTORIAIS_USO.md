# Tutoriais de Uso

## Criar Organização no Setup

1. Acesse `/setup`.
2. Escolha o nicho.
3. Informe nome do negócio.
4. Defina o slug.
5. Revise e finalize.
6. Confirme que foi redirecionado para `/dashboard`.

## Criar Organização pelo Super Admin

1. Entre com e-mail configurado em `NEXT_PUBLIC_GOD_EMAIL`.
2. Acesse `/admin`.
3. Clique para criar novo tenant.
4. Informe nome da organização e e-mail do responsável.
5. O sistema gera senha temporária internamente.
6. O responsável recebe e-mail para definir a própria senha.

## Primeiro Acesso do Cliente

1. Responsável recebe link por e-mail.
2. Abre `/reset-password?first_access=true`.
3. Define senha forte.
4. Entra pelo `/login`.
5. Confere dados da organização.

## Configurar Preferências

1. Acesse `/configuracoes`.
2. Abra aba Preferências.
3. Configure expediente, intervalo e dias de atendimento.
4. Configure duração padrão do atendimento.
5. Salve.
6. Abra a aba novamente e confirme que os valores persistiram.

## Configurar Horários

1. Acesse `/configuracoes/horarios`.
2. Escolha o profissional.
3. Marque dias ativos.
4. Defina início e fim do turno.
5. Defina intervalo/pausa quando houver.
6. Salve.

## Configurar Disponibilidade do Profissional

1. Garanta que o usuário é `professional` ou `admin`.
2. Confirme que existe registro em `professionals`.
3. Acesse `/configuracoes/horarios`.
4. Ajuste a semana.
5. Teste `/marcar/[slug]` para confirmar horários disponíveis.

## Configurar WhatsApp

1. Acesse `/configuracoes`.
2. Abra aba WhatsApp.
3. Clique em gerar QR Code.
4. No celular, abra WhatsApp > Aparelhos conectados.
5. Escaneie o QR Code.
6. Clique em “Já escaneei” para consultar status.
7. Confirme status online.

## Cadastrar Serviço ou Procedimento

1. Acesse `/servicos`.
2. Clique em novo serviço.
3. Informe título, duração, preço e cor.
4. Salve.
5. Confirme que o item está ativo.

## Criar Agendamento Interno

1. Acesse `/agendamentos`.
2. Clique em novo agendamento.
3. Escolha cliente ou cadastre novo.
4. Escolha serviço e profissional.
5. Informe data e horário.
6. Confirme.
7. Verifique se aparece na agenda e no dashboard.

## Usar Agendamento Público

1. Acesse `/marcar/[slug]`.
2. Escolha serviço.
3. Escolha profissional.
4. Escolha data.
5. Selecione horário disponível.
6. Preencha dados.
7. Envie a solicitação.
8. Aguarde confirmação pelo WhatsApp.

## Confirmar ou Cancelar pelo WhatsApp

1. Cliente recebe mensagem de confirmação/solicitação.
2. Cliente responde:
   - `sim` para confirmar;
   - `nao` ou `não` para cancelar.
3. Webhook processa a resposta.
4. Equipe confere status no painel.

## Gerenciar Membros

1. Acesse `/configuracoes/equipe`.
2. Gere convite para `staff` ou `professional`.
3. Envie link ao membro.
4. Membro cria conta ou faz login.
5. Confirme que aparece na equipe.

## Trocar Hierarquia

1. Acesse `/configuracoes/equipe`.
2. Localize o membro.
3. Abra ações.
4. Escolha novo papel.
5. Confirme.
6. Se virar `professional` ou `admin`, confirme que aparece na agenda.
7. Se virar `staff`, confirme que não aparece como profissional ativo.

## Remover Membro

1. Acesse `/configuracoes/equipe`.
2. Localize o membro.
3. Clique em remover.
4. Confirme a remoção.
5. O sistema deve impedir remover `owner` ou remover a si mesmo.

## Recuperar Senha

1. Acesse `/forgot-password`.
2. Informe e-mail.
3. Abra o link recebido.
4. Defina nova senha em `/reset-password`.
5. Entre novamente pelo `/login`.

