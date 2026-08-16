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
2. O link passa por `/auth/callback`.
3. O sistema abre `/update-password?first_access=true`.
4. O responsável informa e confirma uma senha forte.
5. Após salvar, entra pelo `/login`.
6. Confere os dados e conclui o onboarding necessário.

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

## Testar o Tour de Demonstração (regressão)

1. Acesse `/demo/start` e escolha um nicho.
2. Confirme criação do tenant e redirect para `/dashboard?tour=demo`.
3. Siga o tour: resumo, abrir agenda, criar agendamento (evento `eliza:appointment-created`
   avança sozinho ao salvar).
4. Volte para o Dashboard e confirme que a simulação dos avisos automáticos ("Enquanto isso,
   nos bastidores...") aparece **antes** do passo de confirmar chegada, mostrando o
   agendamento recém-criado.
5. Marque chegada e finalize o atendimento — confirme redirect para a ficha do cliente.
6. Salve o registro/prontuário e confirme que o modal de sugestão de retorno abre sozinho.
7. Teste os dois caminhos de saída do retorno:
   - "Agora não" — deve ir direto para o passo de pagamento, na mesma página.
   - Escolher um preset de dias — deve abrir o diálogo de criação em `/agendamentos` já
     preenchido; ao salvar, confirme o redirect automático de volta para a ficha do cliente.
8. Confirme o pagamento e chegue ao passo final (resumo + captura de lead).
9. Envie o lead ou clique "Só terminar"; confirme que aparece em `demo_leads`.
10. Clique "Recomeçar a demonstração" e confirme que o tour volta ao passo 1 com dados novos.
11. Repita clicando fora dos balões em pontos diferentes do tour — nenhum deles deve
    cancelar o tour ou travar a interação com o que abriu por cima.

## Recuperar Senha

1. Acesse `/forgot-password` ou `/reset-password`.
2. Informe e-mail.
3. Abra o link recebido.
4. O link passa por `/auth/callback`.
5. Defina e confirme a nova senha em `/update-password`.
6. Entre novamente pelo `/login`.
