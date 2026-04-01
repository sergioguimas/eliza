import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsForm } from "@/components/settings/settings-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { WhatsappSettings } from "@/components/settings/whatsapp-settings";
import { ProfessionalProfileForm } from "@/components/settings/professional-profile-form";
import { Building, UserPen, NotebookPen, BotMessageSquare } from "lucide-react";
import { Database } from "@/utils/database.types";
import { getDictionary } from "@/lib/dictionaries/get-dictionary";

type ProfileWithOrg = Database["public"]["Tables"]["profiles"]["Row"] & {
  organizations?: Pick<
    Database["public"]["Tables"]["organizations"]["Row"],
    "niche"
  > | null;
};

export default async function SettingsPage() {
  const supabase = await createClient<Database>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(niche)")
    .eq("id", user.id)
    .single();

  const typedProfile = profile as ProfileWithOrg | null;

  if (!typedProfile?.organization_id) {
    return <div>Organização não encontrada</div>;
  }

  const niche = typedProfile.organizations?.niche || "generico";
  const dict = getDictionary(niche);

  const profissionalSingular =
    dict.entities?.profissional

  const { data: professional } = await supabase
    .from("professionals")
    .select("name, license_number, specialty, phone")
    .eq("user_id", user.id)
    .single();

  const isAdminOrOwner = ["admin", "owner"].includes(typedProfile.role ?? "");
  const isProfessional = !!professional;

  let organization = null;
  if (isAdminOrOwner) {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", typedProfile.organization_id)
      .single();

    organization = org;
  }

  const defaultTab = isAdminOrOwner ? "organization" : "profile";

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {dict.nav?.configuracoes || "Configurações"}
        </h1>
        <p className="text-muted-foreground">
          Gerencie seus dados e as preferências do sistema.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="w-full flex flex-wrap h-auto gap-2 bg-transparent p-0">
          {isAdminOrOwner && (
            <TabsTrigger value="organization" className="gap-2">
              <Building className="h-4 w-4" />
              Organização
            </TabsTrigger>
          )}

          {isProfessional && (
            <TabsTrigger value="profile" className="gap-2">
              <UserPen className="h-4 w-4" />
              Meu {profissionalSingular}
            </TabsTrigger>
          )}

          {isAdminOrOwner && (
            <TabsTrigger value="preferences" className="gap-2">
              <NotebookPen className="h-4 w-4" />
              Preferências
            </TabsTrigger>
          )}

          {isAdminOrOwner && (
            <TabsTrigger value="whatsapp" className="gap-2">
              <BotMessageSquare className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
          )}
        </TabsList>

        {isAdminOrOwner && organization && (
          <>
            <TabsContent value="organization">
              <SettingsForm organization={organization} />
            </TabsContent>

            <TabsContent value="preferences">
              <PreferencesForm
                settings={organization}
                organizationId={organization.id}
              />
            </TabsContent>

            <TabsContent value="whatsapp">
              <WhatsappSettings
                settings={organization}
                organizationId={organization.id}
              />
            </TabsContent>
          </>
        )}

        {isProfessional && (
          <TabsContent value="profile">
            <ProfessionalProfileForm initialData={professional} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}