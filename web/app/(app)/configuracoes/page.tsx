import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsForm } from "./settings-form";
import { PreferencesForm } from "./preferences-form";
import { WhatsappSettings } from "./whatsapp-settings";
import { ProfessionalProfileForm } from "./professional-profile-form";
import { Building, UserPen, NotebookPen, BotMessageSquare } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // 1. Busca Profile (Role e Org)
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return <div>Organização não encontrada</div>;
  }

  // 2. Busca Dados do Profissional (se existir)
  const { data: professional } = await supabase
    .from("professionals")
    .select("name, license_number, specialty, phone")
    .eq("user_id", user.id)
    .single();

  const isAdminOrOwner = ["admin", "owner"].includes(profile.role ?? "");
  const isProfessional = !!professional; // Verifica se tem registro na tabela professionals

  // 3. Busca Dados da Organização (apenas se for admin/owner para economizar recurso)
  let organization = null;
  if (isAdminOrOwner) {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();
    organization = org;
  }

  // Define a aba padrão: Se for admin vai pra 'organization', senão vai pra 'profile'
  const defaultTab = isAdminOrOwner ? "organization" : "profile";

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie seus dados e as preferências do sistema.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="w-full">
          {isAdminOrOwner && <TabsTrigger value="organization"><Building/>Organização</TabsTrigger>}
          {isProfessional && <TabsTrigger value="profile"><UserPen/>Meu Perfil</TabsTrigger>}
          {isAdminOrOwner && <TabsTrigger value="preferences"><NotebookPen/>Preferencias</TabsTrigger>}
          {isAdminOrOwner && <TabsTrigger value="whatsapp"><BotMessageSquare/>WhatsApp</TabsTrigger>}
        </TabsList>

        {/* Conteúdo Exclusivo Admin/Owner */}
        {isAdminOrOwner && organization && (
          <>
            <TabsContent value="organization">
              <SettingsForm organization={organization} />
            </TabsContent>
            <TabsContent value="preferences">
              <PreferencesForm settings={organization} organizationId={organization.id}/>
            </TabsContent>
            <TabsContent value="whatsapp">
              <WhatsappSettings settings={organization} organizationId={organization.id}/>
            </TabsContent>
          </>
        )}

        {/* Conteúdo do Profissional */}
        {isProfessional && (
          <TabsContent value="profile">
            <ProfessionalProfileForm initialData={professional} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}