import { getDictionary } from "@/lib/dictionaries/get-dictionary"
import { getNicheMetadata } from "@/lib/niche-config"

export type DemoTourStep = {
  id: string
  /** Rota onde o passo vive. O tour só aparece quando a URL casa. */
  match: RegExp
  /**
   * "popover" (padrão) destaca um elemento real com driver.js. "custom" cede
   * a vez a um componente próprio — a timeline não cabe numa dica de tooltip,
   * é uma sequência animada, e forçá-la ali seria brigar com a ferramenta em
   * vez de usá-la.
   */
  kind?: "popover" | "custom"
  /** Alvo do destaque. Só os passos "popover" precisam disto. */
  selector?: string
  title: string
  description: string
  /**
   * Passo que termina numa navegação do próprio produto. Não mostra botão de
   * avançar: quem avança é a ação do visitante, e o tour reancorna sozinho na
   * rota seguinte.
   */
  awaitsNavigation?: boolean
  /**
   * Passo que só avança quando um evento do produto dispara — não com um
   * clique em "Entendi". Existe para o agendamento: sem isso, o visitante
   * podia dispensar o balão sem ter salvo nada, e o tour seguiria como se
   * tivesse.
   */
  awaitsEvent?: string
}

/**
 * Passos do tour, montados a partir do dicionário do nicho.
 *
 * Nada de texto fixo sobre as entidades: o mesmo passo fala em "paciente" na
 * psicologia e "cliente" na barbearia, porque o Keckleon já resolve isso e ter
 * uma segunda fonte de terminologia é como as duas se contradizem com o tempo.
 *
 * O trajeto acompanha o caminho que o produto já faz sozinho — concluir um
 * atendimento redireciona para a ficha do cliente, onde o retorno é oferecido e
 * o registro é escrito. O tour narra esse fluxo, não inventa outro.
 */
export function buildDemoTour(niche: string): DemoTourStep[] {
  const meta = getNicheMetadata(niche)
  const dict = getDictionary(meta.id)
  const { entities } = dict

  // A copy é escrita para não precisar concordar em gênero com as entidades.
  // "Sessão" é feminino, "paciente" é masculino, e isso muda a cada nicho — um
  // "quantos sessões" na primeira tela custa mais credibilidade do que a frase
  // ganharia em naturalidade. Por isso os termos entram como substantivo solto,
  // depois de dois-pontos ou preposição, nunca com artigo ou quantificador.
  const cliente = entities.cliente.toLowerCase()
  const clientes = entities.cliente_plural.toLowerCase()
  const prontuario = entities.prontuario.toLowerCase()

  // "Chegada confirmada" tem rótulo próprio por nicho (advocacia usa "Presença
  // confirmada", psicologia usa "Paciente chegou") — citar o nome errado no
  // texto do tour, enquanto o menu real mostra outro, quebraria a confiança
  // bem na hora em que o passo pede pra clicar em algo específico. "Finalizar"
  // e "Confirmar pagamento" não têm essa variação (vêm do dicionário base,
  // iguais em todo nicho), por isso ficam fixos no texto.
  const arrivedLabel = dict.actions.arrived

  return [
    {
      id: "resumo",
      match: /^\/dashboard/,
      selector: '[data-tour="dashboard-resumo"]',
      title: "Seu dia em uma tela",
      description: `O resumo de hoje: agenda do dia, base de ${clientes} e o que já entrou no caixa. Está tudo preenchido com dados de exemplo — mexa à vontade.`,
    },
    {
      id: "abrir-agenda",
      match: /^\/dashboard/,
      selector: '[data-tour="nav-agendamentos"]',
      title: "Vamos até a agenda",
      description: `É onde o dia acontece. Abra ${entities.agendamento_plural} para marcar um horário.`,
      awaitsNavigation: true,
    },
    {
      id: "novo-agendamento",
      match: /^\/agendamentos/,
      selector: '[data-tour="novo-agendamento"]',
      title: "Marque na agenda",
      description: `Clique aqui. Já vem com um horário livre, ${entities.profissional_plural.toLowerCase()}, ${entities.servico_plural.toLowerCase()} e ${entities.cliente_plural.toLowerCase()} preenchidos — mude o que quiser e salve.`,
      awaitsEvent: "eliza:appointment-created",
    },
    {
      // Ungated de propósito: "chegada" é um checkpoint informativo, não uma
      // ação que precise ser forçada — um profissional apressado pode ir
      // direto para "Finalizar", e isso é uso legítimo, não erro.
      id: "chegou",
      match: /^\/agendamentos/,
      selector: '[data-tour="agenda-lista"]',
      title: "O paciente chegou?",
      description: `Clique com o botão direito no agendamento (no celular, toque e segure) — ou use o novo botão de ações no card — e marque "${arrivedLabel}". É o primeiro checkpoint do atendimento.`,
    },
    {
      // Continua exigindo navegação de verdade: só marcar "Finalizar" leva o
      // Eliza a redirecionar para a ficha do cliente, e é essa navegação que
      // resolve o passo — não dá pra fingir com um clique em "Entendi".
      id: "finalizado",
      match: /^\/agendamentos/,
      selector: '[data-tour="agenda-lista"]',
      title: "Terminou o atendimento?",
      description: `Abra o mesmo menu — botão direito ou o botão de ações — e marque "Finalizar". O Eliza leva você direto para a ficha do ${cliente}.`,
      awaitsNavigation: true,
    },
    {
      // Aponta para o GATILHO da aba, não para o conteúdo dela: a aba
      // "Prontuário" é a que vem aberta por padrão (preserva o fluxo de
      // retorno automático, que depende disso), então o conteúdo da aba
      // "Agendamentos" não existe no DOM até o clique — só o gatilho já
      // está lá para ser destacado.
      id: "pago",
      match: /^\/clientes\/[^/]+/,
      selector: '[data-tour="tab-agendamentos"]',
      title: "Confirme o pagamento",
      description: `Clique aqui, encontre o atendimento que você acabou de finalizar e confirme a forma de pagamento — mesmo menu de antes.`,
      awaitsEvent: "eliza:appointment-paid",
    },
    {
      id: "retorno",
      match: /^\/clientes\/[^/]+/,
      selector: '[data-tour="ficha-cliente"]',
      title: "Já deixe o retorno marcado",
      description: `Assim que o atendimento termina, o Eliza pergunta se você quer agendar o próximo. É o que faz ${clientes} voltarem sem você precisar correr atrás.`,
    },
    {
      id: "prontuario",
      match: /^\/clientes\/[^/]+/,
      selector: '[data-tour="registro-form"]',
      title: "Registre o que foi feito",
      description: `Aqui isso se chama ${prontuario}. Fica no histórico do ${cliente} e você recupera na próxima visita, sem depender da memória.`,
    },
    {
      // Continua na mesma rota da nota — não precisa de navegação nem de
      // alvo na tela, é um modal por cima de tudo. Fica por último porque
      // fecha o arco com o compromisso que o próprio visitante marcou, antes
      // do próximo passo mostrar o aviso saindo de verdade.
      id: "timeline",
      match: /^\/clientes\/[^/]+/,
      kind: "custom",
      title: "Enquanto isso, nos bastidores",
      description:
        "Mostra os avisos automáticos que o Eliza dispara antes de um compromisso, sem esperar o relógio de verdade chegar lá.",
    },
    {
      // Último passo — mesma rota, mesmo motivo do anterior. `stepNumber`
      // aqui é 10, depois que "chegou" e "pago" alargaram o tour de 8 para
      // 10 passos — exige a migration que sobe o teto de
      // `demo_interactions_step_number_check` junto.
      id: "cta",
      match: /^\/clientes\/[^/]+/,
      kind: "custom",
      title: "Fim do tour",
      description: "Resumo do que foi feito, contato e opção de recomeçar.",
    },
  ]
}
