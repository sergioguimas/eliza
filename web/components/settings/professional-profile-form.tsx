"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  User,
  FileBadge,
  Stethoscope,
  Phone,
  Save,
} from "lucide-react";
import { updateProfessionalProfile } from "@/app/actions/update-professional-profile";
import { useKeckleon } from "@/providers/keckleon-provider";

interface Props {
  initialData: {
    name: string;
    license_number: string | null;
    specialty: string | null;
    phone: string | null;
  } | null;
}

export function ProfessionalProfileForm({ initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const { dict } = useKeckleon();

  const entities = dict.entities || {};
  const actions = dict.actions || {};
  const messages = dict.messages || {};
  const fields = dict.fields || {};

  const profissional =
    entities.profissional || "Profissional";
  const cliente = entities.cliente || "Cliente";
  const agendamento = entities.agendamento || "Agendamento";

  if (!initialData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            {messages.professional_profile_not_found ||
              `${profissional} não encontrado.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await updateProfessionalProfile(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        result.success ||
          messages.updated_success ||
          `${profissional} atualizado com sucesso.`
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {messages.professional_profile_title ||
            `Meu perfil de ${profissional.toLowerCase()}`}
        </CardTitle>

        <CardDescription>
          {messages.professional_profile_description ||
            `Essas informações aparecerão para seus ${cliente.toLowerCase()}s no ${agendamento.toLowerCase()}.`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">
              {fields.display_name || "Nome de exibição"}
            </Label>

            <div className="relative">
              <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                defaultValue={initialData.name}
                className="pl-9"
                placeholder={
                  messages.professional_display_name_placeholder ||
                  `${profissional} exemplo`
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="specialty">
                {fields.specialty || "Especialidade"}
              </Label>

              <div className="relative">
                <Stethoscope className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="specialty"
                  name="specialty"
                  defaultValue={initialData.specialty || ""}
                  className="pl-9"
                  placeholder={
                    messages.specialty_placeholder ||
                    "Ex: área de atuação"
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="license_number">
                {fields.professional_license || "Registro profissional"}
              </Label>

              <div className="relative">
                <FileBadge className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="license_number"
                  name="license_number"
                  defaultValue={initialData.license_number || ""}
                  className="pl-9"
                  placeholder={
                    messages.professional_license_placeholder ||
                    "Ex: 123456/SP"
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">
              {fields.professional_phone || "Telefone profissional"}{" "}
              <span className="text-muted-foreground">
                ({messages.optional_label || "Opcional"})
              </span>
            </Label>

            <div className="relative">
              <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                name="phone"
                defaultValue={initialData.phone || ""}
                className="pl-9"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="flex justify-end p-6 pt-5 border-t mt-4">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {actions.save_changes || "Salvar alterações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}