import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsForm } from "@/components/settings/settings-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { WhatsappSettings } from "@/components/settings/whatsapp-settings";
import { ApiKeysSettings, type ApiKeyRow, type ApiLogRow } from "@/components/settings/api-keys-settings";
import { ProfessionalProfileForm } from "@/components/settings/professional-profile-form";
import { Building, UserPen, NotebookPen, BotMessageSquare, KeyRound } from "lucide-react";
import { Database } from "@/utils/database.types";
import { organizacaoTemApi } from "@/lib/api/plano-da-org";
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

  // B2: o papel `authenticated` não enxerga `organizations.is_demo` (grant de
  // coluna, ver whatsapp-connect.ts), então a marca vem do metadata do
  // usuário — mesmo sinal usado em app/(app)/layout.tsx. O visitante demo
  // chega aqui com papel owner; sem esconder a aba, "Conectar" tentaria criar
  // uma instância solta na Evolution compartilhada (o action já recusa, isto
  // aqui é a camada de UI).
  const isDemoVisitor = user.user_metadata?.is_demo === true;
  const showWhatsappTab = isAdminOrOwner && !isDemoVisitor;

  let organization = null;
  let organizationSettings = null;

  if (isAdminOrOwner) {
    // Só as colunas públicas: authenticated não lê billing nem os campos de
    // WhatsApp (ver migration 20260811120000). O que as abas usam daqui é
    // id/name/slug — o estado do WhatsApp vem de getWhatsappStatus().
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, niche")
      .eq("id", typedProfile.organization_id)
      .single();

    organization = org;

    const { data: settings } = await supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", typedProfile.organization_id)
      .maybeSingle();

    organizationSettings = settings;
  }

  // Chaves e logs vêm pelo client de sessão: o RLS (admin/owner do tenant)
  // é quem escopa. key_hash não é legível por `authenticated` (grant de coluna).
  let apiKeys: ApiKeyRow[] = [];
  let apiLogs: ApiLogRow[] = [];
  let apiAllowed = true;

  if (showWhatsappTab) {
    apiAllowed = await organizacaoTemApi(typedProfile.organization_id);

    const [keysResult, logsResult] = await Promise.all([
      supabase
        .from("api_keys")
        .select("id, name, key_prefix, scopes, created_at, expires_at, revoked_at, last_used_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("api_request_logs")
        .select("id, key_prefix, method, path, status_code, duration_ms, ip, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    apiKeys = keysResult.data ?? [];
    apiLogs = logsResult.data ?? [];
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

          {showWhatsappTab && (
            <TabsTrigger value="whatsapp" className="gap-2">
              <BotMessageSquare className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
          )}

          {showWhatsappTab && (
            <TabsTrigger value="api" className="gap-2">
              <KeyRound className="h-4 w-4" />
              API
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
                settings={organizationSettings || organization}
                organizationId={organization.id}
              />
            </TabsContent>

            {showWhatsappTab && (
              <TabsContent value="api">
                <ApiKeysSettings keys={apiKeys} logs={apiLogs} planAllowsApi={apiAllowed} />
              </TabsContent>
            )}

            {showWhatsappTab && (
              <TabsContent value="whatsapp">
                <WhatsappSettings
                  settings={organization}
                  organizationId={organization.id}
                />
              </TabsContent>
            )}
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