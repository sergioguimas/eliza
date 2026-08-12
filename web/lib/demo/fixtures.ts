import type { DemoNiche } from "@/lib/demo/config"

/**
 * Dados fictícios do tenant de demonstração, por nicho.
 *
 * Os telefones são deliberadamente impossíveis (prefixo 9 seguido de zeros):
 * nenhum deles existe, então nem um engano de código consegue mandar mensagem
 * para uma pessoa real. O único número que a demonstração escreve de verdade é
 * o que o visitante informa com opt-in explícito na Fase 8.
 *
 * A terminologia da interface NÃO vem daqui — vem do Keckleon, a partir do
 * `niche` da organização. Aqui ficam só os nomes próprios e os valores, que
 * precisam soar plausíveis para a pessoa reconhecer o próprio negócio.
 */

export type DemoProfessionalFixture = {
  name: string
  specialty: string
  phone: string
}

export type DemoServiceFixture = {
  title: string
  description: string
  durationMinutes: number
  price: number
}

export type DemoCustomerFixture = {
  name: string
  phone: string
  notes: string
}

export type DemoNicheFixture = {
  professionals: [DemoProfessionalFixture, DemoProfessionalFixture]
  services: [DemoServiceFixture, DemoServiceFixture, DemoServiceFixture]
  /** O primeiro é o cliente recorrente (ganha histórico), o segundo é novo. */
  customers: [DemoCustomerFixture, DemoCustomerFixture]
  /** Conteúdo do registro já preenchido, para o histórico não nascer vazio. */
  recordContent: string
}

export const DEMO_FIXTURES: Record<DemoNiche, DemoNicheFixture> = {
  clinica: {
    professionals: [
      { name: "Dra. Helena Prado", specialty: "Clínica geral", phone: "11900000001" },
      { name: "Dr. Rafael Nunes", specialty: "Cardiologia", phone: "11900000002" },
    ],
    services: [
      { title: "Consulta clínica", description: "Avaliação e conduta", durationMinutes: 30, price: 250 },
      { title: "Retorno", description: "Reavaliação e ajuste de conduta", durationMinutes: 20, price: 120 },
      { title: "Check-up completo", description: "Avaliação ampla com exames", durationMinutes: 60, price: 450 },
    ],
    customers: [
      { name: "Marina Alves", phone: "11900000101", notes: "Acompanhamento desde o ano passado." },
      { name: "Bruno Tavares", phone: "11900000102", notes: "Primeira consulta." },
    ],
    recordContent:
      "Paciente refere melhora do quadro após ajuste da medicação. Pressão aferida dentro do esperado. Mantida a conduta e solicitado retorno em 30 dias.",
  },

  psicologia: {
    professionals: [
      { name: "Dra. Sofia Menezes", specialty: "Psicologia clínica", phone: "11900000001" },
      { name: "Dr. Caio Ribeiro", specialty: "Terapia cognitivo-comportamental", phone: "11900000002" },
    ],
    services: [
      { title: "Sessão de psicoterapia", description: "Atendimento individual", durationMinutes: 50, price: 180 },
      { title: "Avaliação inicial", description: "Acolhimento e definição do plano", durationMinutes: 80, price: 250 },
      { title: "Sessão de casal", description: "Atendimento para o casal", durationMinutes: 60, price: 260 },
    ],
    customers: [
      { name: "Helena Costa", phone: "11900000101", notes: "Acompanhamento quinzenal." },
      { name: "Tiago Moraes", phone: "11900000102", notes: "Encaminhado para avaliação inicial." },
    ],
    recordContent:
      "Relata melhora no sono após as estratégias trabalhadas na sessão anterior. Seguimos com o plano combinado e mantida a frequência quinzenal.",
  },

  barbearia: {
    professionals: [
      { name: "João Farias", specialty: "Corte clássico", phone: "11900000001" },
      { name: "Diego Lopes", specialty: "Barba e navalha", phone: "11900000002" },
    ],
    services: [
      { title: "Corte masculino", description: "Máquina e tesoura", durationMinutes: 40, price: 60 },
      { title: "Barba", description: "Toalha quente e navalha", durationMinutes: 30, price: 45 },
      { title: "Corte + barba", description: "Combo completo", durationMinutes: 70, price: 95 },
    ],
    customers: [
      { name: "Rafael Pinto", phone: "11900000101", notes: "Vem a cada três semanas." },
      { name: "Lucas Andrade", phone: "11900000102", notes: "Cliente novo." },
    ],
    recordContent:
      "Corte na máquina 2 nas laterais, tesoura em cima. Cliente prefere manter a barba alinhada, sem reduzir o volume.",
  },

  salao: {
    professionals: [
      { name: "Camila Duarte", specialty: "Colorimetria", phone: "11900000001" },
      { name: "Priscila Rocha", specialty: "Tratamentos capilares", phone: "11900000002" },
    ],
    services: [
      { title: "Corte e escova", description: "Corte com finalização", durationMinutes: 60, price: 120 },
      { title: "Coloração", description: "Coloração completa", durationMinutes: 120, price: 320 },
      { title: "Hidratação", description: "Tratamento de reconstrução", durationMinutes: 45, price: 90 },
    ],
    customers: [
      { name: "Aline Vasconcelos", phone: "11900000101", notes: "Mantém a coloração a cada dois meses." },
      { name: "Beatriz Nogueira", phone: "11900000102", notes: "Primeira visita." },
    ],
    recordContent:
      "Coloração 7.1 com oxidante 20 volumes, tempo de pausa de 35 minutos. Fios responderam bem, sem sinais de ressecamento.",
  },

  advocacia: {
    professionals: [
      { name: "Dra. Letícia Amaral", specialty: "Direito de família", phone: "11900000001" },
      { name: "Dr. Marcos Beltrão", specialty: "Direito trabalhista", phone: "11900000002" },
    ],
    services: [
      { title: "Consulta jurídica", description: "Análise inicial do caso", durationMinutes: 60, price: 400 },
      { title: "Análise de contrato", description: "Parecer sobre o instrumento", durationMinutes: 90, price: 650 },
      { title: "Acompanhamento processual", description: "Reunião de andamento", durationMinutes: 45, price: 300 },
    ],
    customers: [
      { name: "Eduardo Salles", phone: "11900000101", notes: "Processo em andamento." },
      { name: "Renata Campos", phone: "11900000102", notes: "Primeiro contato." },
    ],
    recordContent:
      "Reunião de alinhamento sobre o andamento do processo. Cliente ciente dos prazos e da documentação pendente para a próxima etapa.",
  },

  tatuador: {
    professionals: [
      { name: "Nina Corrêa", specialty: "Fineline", phone: "11900000001" },
      { name: "Téo Barbosa", specialty: "Blackwork", phone: "11900000002" },
    ],
    services: [
      { title: "Sessão pequena", description: "Peças de até uma hora", durationMinutes: 60, price: 300 },
      { title: "Sessão média", description: "Peças maiores", durationMinutes: 120, price: 600 },
      { title: "Retoque", description: "Ajuste pós-cicatrização", durationMinutes: 30, price: 150 },
    ],
    customers: [
      { name: "Pedro Vasques", phone: "11900000101", notes: "Projeto de braço fechado, em etapas." },
      { name: "Ana Furtado", phone: "11900000102", notes: "Primeira tatuagem." },
    ],
    recordContent:
      "Segunda etapa do projeto: contorno concluído no antebraço. Cicatrização da etapa anterior sem intercorrências. Próxima sessão para sombreamento.",
  },

  generico: {
    professionals: [
      { name: "Ana Martins", specialty: "Atendimento", phone: "11900000001" },
      { name: "Paulo Ferraz", specialty: "Atendimento", phone: "11900000002" },
    ],
    services: [
      { title: "Atendimento padrão", description: "Serviço completo", durationMinutes: 60, price: 150 },
      { title: "Atendimento expresso", description: "Versão reduzida", durationMinutes: 30, price: 90 },
      { title: "Retorno", description: "Acompanhamento", durationMinutes: 30, price: 80 },
    ],
    customers: [
      { name: "Joana Lima", phone: "11900000101", notes: "Cliente recorrente." },
      { name: "Ricardo Souza", phone: "11900000102", notes: "Cliente novo." },
    ],
    recordContent:
      "Atendimento realizado conforme combinado. Cliente satisfeito com o resultado e retorno agendado para acompanhamento.",
  },
}
