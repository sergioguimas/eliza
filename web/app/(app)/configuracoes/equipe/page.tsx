import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { Plus, Mail, Shield, Trash2 } from "lucide-react"
import { InviteCard } from "@/components/invite-card"

// --- TIPAGEM MANUAL (BLINDAGEM) ---
type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  role: 'owner' | 'admin' | 'professional' | 'staff'
  organization_id: string
  avatar_url: string | null
}

export default async function EquipePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // 1. Buscar Meu Perfil (Com Casting Manual)
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const myProfile = rawProfile as unknown as ProfileRow

  // Se não tiver org, volta pro setup
  if (!myProfile?.organization_id) {
    redirect('/setup')
  }

  // 2. Buscar Membros da Equipe (Com Casting Manual)
  const { data: rawMembers } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', myProfile.organization_id)
    .order('full_name', { ascending: true })

  const members = (rawMembers || []) as unknown as ProfileRow[]

  // Helper de iniciais
  const getInitials = (name: string | null) => 
    name ? name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : '??'

  // Helper de Label de Cargo
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Dono / Proprietário'
      case 'admin': return 'Administrador'
      case 'professional': return 'Profissional'
      default: return 'Staff / Recepção'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gerenciar Equipe</h2>
          <p className="text-muted-foreground">
            Controle quem tem acesso ao sistema e suas permissões.
          </p>
        </div>
        <InviteCard organizationId={myProfile.organization_id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros Ativos</CardTitle>
          <CardDescription>
            Usuários que possuem acesso ao painel da sua organização.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Avatar</TableHead>
                <TableHead>Nome & Email</TableHead>
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
                      <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.full_name || "Sem nome"}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {member.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                      {member.role === 'owner' && <Shield className="w-3 h-3 mr-1" />}
                      {getRoleLabel(member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Não permite deletar a si mesmo ou o dono se vc não for dono */}
                    {member.id !== user.id && member.role !== 'owner' && (
                       <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                         <Trash2 className="h-4 w-4" />
                       </Button>
                       // <RemoveMemberButton memberId={member.id} />
                    )}
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