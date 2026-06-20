import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Mail, Shield } from "lucide-react"
import { InviteCard } from "@/components/shared/invite-card"
import { Database } from "@/utils/database.types"
import { getDictionary } from "@/lib/dictionaries/get-dictionary"
import { TeamMemberActions } from "@/components/settings/team-member-actions"

type MemberRole = "owner" | "admin" | "professional" | "staff"

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  role: MemberRole
  organization_id: string
  avatar_url: string | null
  organizations?: {
    niche?: string | null
  } | null
}

export default async function EquipePage() {
  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*, organizations(niche)")
    .eq("id", user.id)
    .single()

  const myProfile = {
    ...(rawProfile as any),
    role: normalizeRole((rawProfile as any)?.role),
  } as ProfileRow

  if (!myProfile?.organization_id) {
    redirect("/setup")
  }

  const niche = myProfile.organizations?.niche || "generico"
  const dict = getDictionary(niche)

  const profissionalSingular =
    dict.entities?.profissional
  const profissionalPlural =
    dict.entities?.profissional_plural

  const { data: rawMembers } = await supabase
    .from("profiles")
    .select("*")
    .eq("organization_id", myProfile.organization_id)
    .order("full_name", { ascending: true })

  const members = ((rawMembers || []) as any[]).map((member) => ({
    ...member,
    role: normalizeRole(member.role),
  })) as ProfileRow[]

  const getInitials = (name: string | null) =>
    name
      ? name
          .split(" ")
          .slice(0, 2)
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "??"

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Dono / Proprietário"
      case "admin":
        return "Administrador"
      case "professional":
        return profissionalSingular
      default:
        return "Staff / Recepção"
    }
  }
  
  function normalizeRole(role: string | null): MemberRole {
    if (
      role === "owner" ||
      role === "admin" ||
      role === "professional" ||
      role === "staff"
    ) {
      return role
    }

    return "staff"
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {dict.nav?.equipe || "Equipe"}
          </h1>
          <p className="text-muted-foreground">
            Gerencie quem tem acesso ao sistema e as permissões da sua organização.
          </p>
        </div>

        <InviteCard organizationId={myProfile.organization_id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{profissionalPlural}</CardTitle>
          <CardDescription>
            Usuários com acesso ativo ao painel da sua organização.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Avatar</TableHead>
                <TableHead>Nome e e-mail</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Avatar>
                      <AvatarImage src={member.avatar_url || ""} />
                      <AvatarFallback>
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {member.full_name || "Sem nome"}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={member.role === "owner" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {member.role === "owner" && (
                        <Shield className="w-3 h-3 mr-1" />
                      )}
                      {getRoleLabel(member.role)}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <TeamMemberActions
                      memberId={member.id}
                      memberName={member.full_name || member.email || "este membro"}
                      memberRole={member.role}
                      currentUserRole={myProfile.role}
                      isCurrentUser={member.id === user.id}
                      professionalLabel={profissionalSingular}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}