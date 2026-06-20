"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

type MemberRole = "admin" | "professional" | "staff"

async function getCurrentProfile() {
  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
      error: "Usuário não autenticado.",
    }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", user.id)
    .single()

  if (error || !profile) {
    return {
      supabase,
      user,
      profile: null,
      error: "Perfil não encontrado.",
    }
  }

  return {
    supabase,
    user,
    profile,
    error: null,
  }
}

function canManageMembers(role: string | null) {
  return role === "owner" || role === "admin"
}

function canChangeRole(actorRole: string | null, targetRole: string | null) {
  if (actorRole === "owner") {
    return targetRole !== "owner"
  }

  if (actorRole === "admin") {
    return targetRole !== "owner" && targetRole !== "admin"
  }

  return false
}

export async function removeTeamMember(memberId: string) {
  const { supabase, user, profile, error } = await getCurrentProfile()

  if (error || !user || !profile) {
    return { error: error || "Não autorizado." }
  }

  if (!profile.organization_id) {
    return { error: "Organização não encontrada para o usuário atual." }
    }

    const organizationId = profile.organization_id

  if (!canManageMembers(profile.role)) {
    return { error: "Você não tem permissão para remover membros." }
  }

  if (memberId === user.id) {
    return { error: "Você não pode remover a si mesmo da equipe." }
  }

  const { data: targetMember, error: targetError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", memberId)
    .single()

  if (targetError || !targetMember) {
    return { error: "Membro não encontrado." }
  }

  if (targetMember.organization_id !== profile.organization_id) {
    return { error: "Este membro não pertence à sua organização." }
  }

  if (targetMember.role === "owner") {
    return { error: "O proprietário da organização não pode ser removido." }
  }

  if (profile.role === "admin" && targetMember.role === "admin") {
    return { error: "Administradores não podem remover outros administradores." }
  }

  const { error: professionalsError } = await supabase
    .from("professionals")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", memberId)
    .eq("organization_id", profile.organization_id)

  if (professionalsError) {
    console.error("[removeTeamMember:professionals]", professionalsError)
    return { error: "Erro ao desativar registro profissional." }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      organization_id: null,
      role: "staff",
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("organization_id", profile.organization_id)

  if (profileError) {
    console.error("[removeTeamMember:profiles]", profileError)
    return { error: "Erro ao remover membro da organização." }
  }

  revalidatePath("/configuracoes/equipe")

  return { success: true }
}

export async function updateTeamMemberRole(
  memberId: string,
  role: MemberRole
) {
  const { supabase, user, profile, error } = await getCurrentProfile()

  if (error || !user || !profile) {
    return { error: error || "Não autorizado." }
  }

  if (!profile.organization_id) {
    return { error: "Organização não encontrada para o usuário atual." }
    }  

    const organizationId = profile.organization_id

  if (!canManageMembers(profile.role)) {
    return { error: "Você não tem permissão para alterar permissões." }
  }

  if (memberId === user.id) {
    return { error: "Você não pode alterar a sua própria permissão." }
  }

  if (!["admin", "professional", "staff"].includes(role)) {
    return { error: "Permissão inválida." }
  }

  const { data: targetMember, error: targetError } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name")
    .eq("id", memberId)
    .single()

  if (targetError || !targetMember) {
    return { error: "Membro não encontrado." }
  }

  if (targetMember.organization_id !== profile.organization_id) {
    return { error: "Este membro não pertence à sua organização." }
  }

  if (!canChangeRole(profile.role, targetMember.role)) {
    return { error: "Você não tem permissão para alterar este membro." }
  }

  if (targetMember.role === "owner") {
    return { error: "A permissão do proprietário não pode ser alterada." }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("organization_id", organizationId)

  if (profileError) {
    console.error("[updateTeamMemberRole:profiles]", profileError)
    return { error: "Erro ao atualizar permissão." }
  }

  if (role === "professional" || role === "admin") {
    const { data: existingProfessional } = await supabase
      .from("professionals")
      .select("id")
      .eq("user_id", memberId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (existingProfessional) {
      const { error: professionalUpdateError } = await supabase
        .from("professionals")
        .update({
          is_active: true,
          name: targetMember.full_name || "Sem nome",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfessional.id)

      if (professionalUpdateError) {
        console.error(
          "[updateTeamMemberRole:professionals:update]",
          professionalUpdateError
        )
        return { error: "Permissão atualizada, mas houve erro no profissional." }
      }
    } else {
      const { error: professionalInsertError } = await supabase
        .from("professionals")
        .insert({
          user_id: memberId,
          organization_id: organizationId,
          name: targetMember.full_name || "Sem nome",
          is_active: true,
        })

      if (professionalInsertError) {
        console.error(
          "[updateTeamMemberRole:professionals:insert]",
          professionalInsertError
        )
        return { error: "Permissão atualizada, mas houve erro no profissional." }
      }
    }
  } else {
    const { error: professionalDeactivateError } = await supabase
      .from("professionals")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", memberId)
      .eq("organization_id", organizationId)

    if (professionalDeactivateError) {
      console.error(
        "[updateTeamMemberRole:professionals:deactivate]",
        professionalDeactivateError
      )
      return { error: "Permissão atualizada, mas houve erro no profissional." }
    }
  }

  revalidatePath("/configuracoes/equipe")

  return { success: true }
}