"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { DayAvailability } from "@/lib/types";

export async function updateProfessionalAvailability(
  professionalId: string,
  availabilities: DayAvailability[]
) {
  const supabase = await createClient();

  // 1. Validação de Segurança: O usuário só pode editar a própria agenda 
  // ou ser um admin/owner da mesma organização.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  // 2. Mapeamento para o formato da tabela professional_availability
  const upsertData = availabilities.map((item) => ({
    professional_id: professionalId,
    day_of_week: item.day_of_week,
    start_time: item.start_time,
    end_time: item.end_time,
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

  revalidatePath("/configuracoes/equipe");
  return { success: true };
}