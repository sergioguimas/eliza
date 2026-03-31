import { createClient } from "@/utils/supabase/server";
import { AvailabilityForm } from "@/components/settings/availability-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Database } from "@/utils/database.types";
import { getDictionary } from "@/lib/get-dictionary";

type ProfileWithOrg = {
  role: string | null;
  organization_id: string | null;
  organizations?: {
    niche?: string | null;
  } | null;
};

export default async function HorariosPage() {
  const supabase = await createClient<Database>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return <div>Não autorizado</div>;

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("role, organization_id, organizations(niche)")
    .eq("id", user.id)
    .single();

  const profile = rawProfile as ProfileWithOrg | null;

  if (!profile?.organization_id) {
    return <div>Erro: Organização não encontrada.</div>;
  }

  const niche = profile.organizations?.niche || "generico";
  const dict = getDictionary(niche);

  const profissionalSingular =
    dict.entities?.profissional || dict.label_profissional;

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
        Nenhum {profissionalSingular.toLowerCase()} encontrado para esta organização.
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Gestão de agendas
        </h1>
        <p className="text-muted-foreground">
          Defina horários e intervalos individuais para cada{" "}
          {profissionalSingular.toLowerCase()}.
        </p>
      </div>

      <Tabs defaultValue={professionals[0].id} className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-transparent border-b rounded-none p-0 mb-6 gap-2">
          {professionals.map((pro) => (
            <TabsTrigger
              key={pro.id}
              value={pro.id}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              {pro.name?.split(" ")[0] || profissionalSingular}
            </TabsTrigger>
          ))}
        </TabsList>

        {professionals.map((pro) => {
          const canEdit =
            ["admin", "owner"].includes(profile.role ?? "") ||
            pro.user_id === user.id;

          return (
            <TabsContent key={pro.id} value={pro.id}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    Agenda semanal de {pro.name || profissionalSingular}
                  </CardTitle>

                  <CardDescription>
                    Ajuste os horários de {pro.name || profissionalSingular}.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <AvailabilityForm
                    professionalId={pro.id}
                    professionalName={pro.name || profissionalSingular}
                    initialData={
                      allAvailabilities?.filter(
                        (a) => a.professional_id === pro.id
                      ) || []
                    }
                    readOnly={!canEdit}
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