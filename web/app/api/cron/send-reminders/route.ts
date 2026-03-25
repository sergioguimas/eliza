import { NextResponse } from "next/server"
import { processDoctorDailySummaries, processPatientMorningReminders } from "../reminders"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    // 🔐 Segurança (obrigatório em produção)
    const authHeader = req.headers.get("authorization")
    const expected = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      )
    }

    console.log("⏰ [CRON] Iniciando processamento de lembretes...")

    // 🚀 Executa os dois fluxos em paralelo
    const [doctorResult, patientResult] = await Promise.all([
      processDoctorDailySummaries(),
      processPatientMorningReminders(),
    ])

    console.log("✅ [CRON] Finalizado com sucesso")

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      doctor: doctorResult,
      patient: patientResult,
    })
  } catch (error: any) {
    console.error("🔥 [CRON] Erro geral:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}