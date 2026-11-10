import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { listarCategorias } from "@/lib/domain/categorias"
import { LIMITE_ITENS_ATIVOS, listarVitrine } from "@/lib/domain/vitrine"
import { VitrinePainel } from "@/components/vitrine/vitrine-painel"

export const metadata: Metadata = {
  title: "Vitrine",
}

export default async function VitrinePage() {
  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) redirect("/setup")

  // Só owner/admin (contrato midia-vitrine/05 §0). Para os demais a página não existe, como em /configuracoes/atendente.
  if (profile.role !== "owner" && profile.role !== "admin") notFound()

  const db = createAdminClient<Database>()
  const [itens, categorias] = await Promise.all([
    listarVitrine(db, profile.organization_id),
    listarCategorias(db, profile.organization_id),
  ])

  return (
    <VitrinePainel
      itens={itens}
      categorias={categorias.map((c) => c.nome)}
      limiteAtivos={LIMITE_ITENS_ATIVOS}
    />
  )
}
