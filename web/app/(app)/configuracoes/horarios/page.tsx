import { createClient } from "@/utils/supabase/server";
import { AvailabilityForm } from "./availability-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function HorariosPage() {
  const supabase = await createClient();

  const { data: orgId } = await supabase.rpc('get_user_org_id');

  if (!orgId) return <div>Erro: Organização não encontrada.</div>;
  const { data: professionals, error } = await supabase
    .from("profiles")
    .select("id, full_name, organization_id")
    .eq("organization_id", orgId)
    .in("role", ["professional", "owner", "admin"]);

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
              {pro.full_name?.split(' ')[0] || 'Profissional'}
            </TabsTrigger>
          ))}
        </TabsList>

        {professionals.map((pro) => (
          <TabsContent key={pro.id} value={pro.id}>
            <Card>
              <CardHeader>
                <CardTitle>Agenda semanal de {pro.full_name || 'Profissional'}</CardTitle>
                <CardDescription>
                  Ajuste os horários de {pro.full_name} para o assistente de IA.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AvailabilityForm 
                  professionalId={pro.id}
                  professionalName={pro.full_name || "Profissional"}
                  initialData={allAvailabilities?.filter(a => a.professional_id === pro.id) || []}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}