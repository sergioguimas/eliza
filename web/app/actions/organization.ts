'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

const createOrgSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  slug: z.string().min(3, "O slug deve ter pelo menos 3 caracteres")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e traços"),
  niche: z.enum(['clinica', 'barbearia', 'salao', 'advocacia', 'generico'])
})

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Usuário não autenticado." }
  }

  const rawData = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    niche: formData.get("niche"),
  }

  const result = createOrgSchema.safeParse(rawData)

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { name, slug, niche } = result.data

  try {
    // 2. Preparar o Payload
    const newOrg = {
      name,
      slug,
      niche, 
      subscription_status: 'active',
      plan: 'free'
    }

    // 3. Inserir Organização
    const { data: org, error: orgError } = await (supabase.from("organizations") as any)
      .insert(newOrg)
      .select()
      .single()

    if (orgError) {
      if (orgError.code === '23505') {
        return { error: "Este slug (URL) já está em uso. Escolha outro." }
      }
      console.error("Erro ao criar org:", orgError)
      return { error: "Erro ao criar organização." }
    }

    // 4. Atualizar Perfil
    const updateProfile = {
      organization_id: org.id,
      role: 'owner'
    }

    const { error: profileError } = await (supabase.from("profiles") as any)
      .update(updateProfile)
      .eq("id", user.id)

    if (profileError) {
      console.error("Erro ao vincular perfil:", profileError)
    }

  } catch (error) {
    console.error("Erro inesperado:", error)
    return { error: "Erro interno do servidor." }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}