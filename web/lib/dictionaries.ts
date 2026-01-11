export const dictionaries = {
  // O nome da chave deve ser IDÊNTICO ao que está salvo na coluna 'niche' do banco
  clinica: {
    label_cliente: "Paciente",
    label_profissional: "Especialista",
    label_prontuario: "Prontuário",
    label_servico: "Procedimento",
    msg_boas_vindas: "Bem-vindo à clínica",
    icon_set: "health"
  },
  barbearia: {
    label_cliente: "Cliente",
    label_profissional: "Barbeiro",
    label_prontuario: "Histórico de Cortes",
    label_servico: "Procedimento",
    msg_boas_vindas: "Bem-vindo à barbearia",
    icon_set: "grooming"
  },
  salao: {
    label_cliente: "Cliente",
    label_profissional: "Profissional",
    label_prontuario: "Ficha Técnica",
    label_servico: "Procedimento",
    msg_boas_vindas: "Bem-vindo ao salão",
    icon_set: "beauty"
  },
  advocacia: {
    label_cliente: "Cliente",
    label_profissional: "Advogado",
    label_prontuario: "Processo/Caso",
    label_servico: "Processo",
    msg_boas_vindas: "Bem-vindo ao escritório de advocacia",
    icon_set: "legal"
  },
  generico: {
    label_cliente: "Cliente",
    label_profissional: "Profissional",
    label_prontuario: "Anotações",
    label_servico: "Serviço",
    msg_boas_vindas: "Bem-vindo",
    icon_set: "generic"
  }
}

// Tipo auxiliar para o TypeScript te ajudar com o autocomplete
export type NicheType = keyof typeof dictionaries