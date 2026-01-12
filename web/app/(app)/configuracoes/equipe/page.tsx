import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { InviteCard } from "@/components/invite-card"

export default async function EquipePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Descobrir qual a org do usuário logado
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!myProfile?.organization_id) redirect('/setup')

  // 2. Buscar TODOS os membros dessa org
  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', myProfile.organization_id)
    .order('created_at')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Gestão de Equipe</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie quem tem acesso à sua organização.
          </p>
        </div>
        {/* Futuro Botão de Convidar */}
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" /> Convidar Membro
        </Button>
      </div>
        <InviteCard />
      <div className="grid gap-4">
        {members?.map((member) => (
          <Card key={member.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>
                    {member.full_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.full_name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                  {member.role === 'admin' ? 'Proprietário' : 'Colaborador'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}