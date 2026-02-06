import { createClient } from "@/utils/supabase/server";
import { AvailabilityForm } from "./availability-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function HorariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) return <div>Não autorizado</div>;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return <div>Erro: Organização não encontrada.</div>;
  
  const { data: professionals, error } = await supabase
    .from("professionals")
    .select("id, name, user_id, organization_id")
    .eq("organization_id", profile.organization_id);

  const { data: allAvailabilities } = await supabase
    .from("professional_availability")
    .select("*");

  if (error || !professionals || professionals.length === 0) {
    return (
      <div className="p-4 text-muted-foreground">
        Nenhum profissional encontrado para esta organização.
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Agendas</h1>
        <p className="text-muted-foreground">Defina turnos e intervalos individuais para cada membro da equipe.</p>
      </div>

      <Tabs defaultValue={professionals[0].id} className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-transparent border-b rounded-none p-0 mb-6 gap-2">
          {professionals.map((pro) => (
            <TabsTrigger 
              key={pro.id} 
              value={pro.id}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              {pro.name?.split(' ')[0] || 'Profissional'}
            </TabsTrigger>
          ))}
        </TabsList>

        {professionals.map((pro) => {
          // Lógica de Permissão para o Frontend
          const canEdit = 
            ["admin", "owner"].includes(profile.role ?? "") || 
            (pro.user_id === user.id);

          return (
            <TabsContent key={pro.id} value={pro.id}>
              <Card>
                <CardHeader>
                  <CardTitle>Agenda semanal de {pro.name || 'Profissional'}</CardTitle>
                  <CardDescription>
                    Ajuste os horários de {pro.name} para o assistente de IA.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AvailabilityForm 
                    professionalId={pro.id}
                    professionalName={pro.name || "Profissional"}
                    initialData={allAvailabilities?.filter(a => a.professional_id === pro.id) || []}
                    readOnly={!canEdit} // Bloqueia edição se não for dono ou admin
                  />
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}