type NicheEntities = {
  cliente: string
  cliente_plural: string
  profissional: string
  profissional_plural: string
  prontuario: string
  prontuario_plural: string
  servico: string
  servico_plural: string
  agendamento: string
  agendamento_plural: string
}

type NicheConfig = {
  niche_label: string
  icon_set: string
  entities: NicheEntities
  boas_vindas: string
  dashboard_title: string
  dashboard_description?: string
  appointment_redirect_target?: string
  notes_placeholder?: string
  return_prompt_title?: string
  return_prompt_description_suffix?: string
  estimate_notes_placeholder?: string
  arrived_label?: string
  gender?: "m" | "f"
}

function lowercaseFirst(value: string) {
  if (!value) return value
  return value.charAt(0).toLowerCase() + value.slice(1)
}


function buildNiche(config: NicheConfig) {
  const { entities } = config

  const clienteLower = lowercaseFirst(entities.cliente)
  const servicoLower = lowercaseFirst(entities.servico)
  const servicoPluralLower = lowercaseFirst(entities.servico_plural)
  const agendamentoLower = lowercaseFirst(entities.agendamento)
  const agendamentoPluralLower = lowercaseFirst(entities.agendamento_plural)

  const genderSuffix = config.gender === "f" ? "a" : "o"

  const redirectTarget =
    config.appointment_redirect_target || lowercaseFirst(entities.prontuario)

  return {
    niche_label: config.niche_label,

    entities,

    nav: {
      clientes: entities.cliente_plural,
      servicos: entities.servico_plural,
      agendamentos: entities.agendamento_plural,
    },

    actions: {
      create_cliente: `Novo ${clienteLower}`,
      create_servico: `Novo ${servicoLower}`,
      create_agendamento: `Novo ${agendamentoLower}`,
      add_service: `Adicionar ${servicoLower}`,
      arrived: config.arrived_label || "Chegada confirmada",
      edit_cliente: `Editar ${entities.cliente}`,
    },

    messages: {
      boas_vindas: config.boas_vindas,
      dashboard_title: config.dashboard_title,
      dashboard_description:
        config.dashboard_description || "Resumo operacional do dia.",

      clientes_empty_title: `Nenhum ${clienteLower} cadastrado`,
      clientes_empty_description: `Cadastre seu primeiro ${clienteLower} para começar.`,

      servicos_empty_title: `Nenhum ${servicoLower} cadastrado`,
      servicos_empty_description: `Adicione os ${servicoPluralLower} oferecidos.`,

      agendamentos_empty_title: `Nenhum ${agendamentoLower} encontrado`,
      agendamentos_empty_description: `Os próximos ${agendamentoPluralLower} aparecerão aqui.`,

      appointment_completed_redirect: `${entities.agendamento} finalizad${genderSuffix}! Redirecionando para ${redirectTarget}...`,
      appointment_updated: `${entities.agendamento} atualizad${genderSuffix} com sucesso!`,
      canceled_success: `${entities.agendamento} cancelad${genderSuffix} com sucesso.`,
      canceled: `${entities.agendamento} cancelad${genderSuffix}`,

      created_success: `${entities.agendamento} criad${genderSuffix} com sucesso!`,
      error_create: `Erro ao criar ${agendamentoLower}.`,

      notes_placeholder:
        config.notes_placeholder || "Observações adicionais...",

      return_prompt_title:
        config.return_prompt_title || `Agendar próximo ${agendamentoLower}?`,

      return_prompt_description_prefix: "O atendimento de",
      return_prompt_description_suffix:
        config.return_prompt_description_suffix ||
        `foi registrado. Deseja preparar o próximo ${agendamentoLower}?`,

      estimate_notes_placeholder:
        config.estimate_notes_placeholder ||
        "Observações adicionais...",

      selected_services: `${entities.servico_plural} selecionados`,
      customer_deleted_success: `${entities.cliente} removido com sucesso.`,
      delete_customer_confirm: `Excluir ${clienteLower}?`,
    },
  } as const
}

export const nicheDictionaries = {
  clinica: buildNiche({
    niche_label: "Saúde / Clínica",
    icon_set: "health",
    boas_vindas: "Bem-vindo à clínica",
    dashboard_title: "Visão geral da clínica",
    appointment_redirect_target: "o prontuário",
    notes_placeholder: "Ex: Primeira consulta, convênio, etc...",
    return_prompt_title: "Agendar retorno?",
    return_prompt_description_suffix:
      "foi registrado. Deseja deixar o retorno pré-agendado para garantir a vaga?",
    estimate_notes_placeholder:
      "Condições de pagamento ou observações clínicas...",
    entities: {
      cliente: "Paciente",
      cliente_plural: "Pacientes",
      profissional: "Especialista",
      profissional_plural: "Especialistas",
      prontuario: "Prontuário",
      prontuario_plural: "Prontuários",
      servico: "Procedimento",
      servico_plural: "Procedimentos",
      agendamento: "Consulta",
      agendamento_plural: "Consultas",
    },
  }),

  barbearia: buildNiche({
    niche_label: "Barbearia",
    icon_set: "grooming",
    boas_vindas: "Bem-vindo à barbearia",
    dashboard_title: "Visão geral da barbearia",
    appointment_redirect_target: "o histórico",
    notes_placeholder: "Ex: Corte social, barba completa, preferência do cliente...",
    return_prompt_title: "Agendar próximo horário?",
    return_prompt_description_suffix:
      "foi registrado. Deseja deixar o próximo horário preparado?",
    estimate_notes_placeholder:
      "Condições de pagamento ou observações adicionais...",
    arrived_label: "Cliente chegou",
    entities: {
      cliente: "Cliente",
      cliente_plural: "Clientes",
      profissional: "Barbeiro",
      profissional_plural: "Barbeiros",
      prontuario: "Histórico de Cortes",
      prontuario_plural: "Históricos de Cortes",
      servico: "Procedimento",
      servico_plural: "Procedimentos",
      agendamento: "Horário",
      agendamento_plural: "Horários",
    },
  }),

  salao: buildNiche({
    niche_label: "Salão de Beleza",
    icon_set: "beauty",
    boas_vindas: "Bem-vindo ao salão",
    dashboard_title: "Visão geral do salão",
    appointment_redirect_target: "a ficha técnica",
    notes_placeholder:
      "Ex: primeira sessão, coloração, observações importantes...",
    return_prompt_title: "Agendar retorno?",
    return_prompt_description_suffix:
      "foi registrado. Deseja deixar o próximo agendamento preparado?",
    estimate_notes_placeholder:
      "Condições de pagamento ou observações adicionais...",
    arrived_label: "Cliente chegou",
    entities: {
      cliente: "Cliente",
      cliente_plural: "Clientes",
      profissional: "Profissional",
      profissional_plural: "Profissionais",
      prontuario: "Ficha Técnica",
      prontuario_plural: "Fichas Técnicas",
      servico: "Procedimento",
      servico_plural: "Procedimentos",
      agendamento: "Agendamento",
      agendamento_plural: "Agendamentos",
    },
  }),

  advocacia: buildNiche({
    niche_label: "Advocacia / Jurídico",
    icon_set: "legal",
    boas_vindas: "Bem-vindo ao escritório de advocacia",
    dashboard_title: "Visão geral do escritório",
    appointment_redirect_target: "o processo",
    notes_placeholder: "Ex: reunião inicial, audiência, detalhes do caso...",
    return_prompt_title: "Agendar próximo compromisso?",
    return_prompt_description_suffix:
      "foi registrado. Deseja deixar o próximo compromisso preparado?",
    estimate_notes_placeholder:
      "Condições comerciais ou observações adicionais...",
    arrived_label: "Presença confirmada",
    entities: {
      cliente: "Cliente",
      cliente_plural: "Clientes",
      profissional: "Advogado",
      profissional_plural: "Advogados",
      prontuario: "Processo/Caso",
      prontuario_plural: "Processos/Casos",
      servico: "Processo",
      servico_plural: "Processos",
      agendamento: "Compromisso",
      agendamento_plural: "Compromissos",
    },
  }),

  certificado: buildNiche({
    niche_label: "Certificados Digitais",
    icon_set: "certification",
    boas_vindas: "Bem-vindo ao sistema de certificados",
    dashboard_title: "Visão geral da certificadora",
    appointment_redirect_target: "o certificado",
    notes_placeholder:
      "Ex: renovação, validação presencial, observações do atendimento...",
    return_prompt_title: "Agendar próximo atendimento?",
    return_prompt_description_suffix:
      "foi registrado. Deseja deixar o próximo atendimento preparado?",
    estimate_notes_placeholder:
      "Condições comerciais ou observações adicionais...",
    arrived_label: "Cliente presente",
    entities: {
      cliente: "Cliente",
      cliente_plural: "Clientes",
      profissional: "Agente de Registro",
      profissional_plural: "Agentes de Registro",
      prontuario: "Certificado",
      prontuario_plural: "Certificados",
      servico: "Serviço",
      servico_plural: "Serviços",
      agendamento: "Atendimento",
      agendamento_plural: "Atendimentos",
    },
  }),

  generico: buildNiche({
    niche_label: "Outro Negócio",
    icon_set: "generic",
    boas_vindas: "Bem-vindo",
    dashboard_title: "Visão geral",
    appointment_redirect_target: "as anotações",
    notes_placeholder: "Observações adicionais...",
    return_prompt_title: "Agendar próximo compromisso?",
    return_prompt_description_suffix:
      "foi registrado. Deseja deixar o próximo agendamento preparado?",
    estimate_notes_placeholder:
      "Condições comerciais ou observações adicionais...",
    entities: {
      cliente: "Cliente",
      cliente_plural: "Clientes",
      profissional: "Profissional",
      profissional_plural: "Profissionais",
      prontuario: "Anotações",
      prontuario_plural: "Anotações",
      servico: "Serviço",
      servico_plural: "Serviços",
      agendamento: "Agendamento",
      agendamento_plural: "Agendamentos",
    },
  }),
  
} as const

export type NicheKey = keyof typeof nicheDictionaries