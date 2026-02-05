"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { DayAvailability } from "@/lib/types";

export async function updateProfessionalAvailability(
  professionalId: string,
  availabilities: DayAvailability[]
) {
  const supabase = await createClient();

  // 1. Validação de Segurança
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  // 2. Mapeamento conforme o Schema
  const upsertData = availabilities.map((item) => ({
    professional_id: professionalId,
    day_of_week: item.day_of_week,
    start_time: item.start_time,
    end_time: item.end_time,
    break_start: (item as any).break_start || null,
    break_end: (item as any).break_end || null,
    is_active: item.is_active,
  }));

  // 3. Execução do Upsert
  const { error } = await supabase
    .from("professional_availability")
    .upsert(upsertData, {
      onConflict: "professional_id, day_of_week",
    });

  if (error) {
    console.error("Erro ao atualizar disponibilidade:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/configuracoes/horarios");
  return { success: true };
}