"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfessionalProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Não autorizado" };

  const name = formData.get("name") as string;
  const license_number = formData.get("license_number") as string;
  const specialty = formData.get("specialty") as string;
  const phone = formData.get("phone") as string;

  if (!name) return { error: "O nome é obrigatório." };

  // Atualiza apenas o registro do próprio usuário logado
  const { error } = await supabase
    .from("professionals")
    .update({
      name,
      license_number,
      specialty,
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("Erro ao atualizar perfil profissional:", error);
    return { error: "Erro ao atualizar perfil." };
  }

  revalidatePath("/configuracoes");
  return { success: "Perfil atualizado com sucesso!" };
}