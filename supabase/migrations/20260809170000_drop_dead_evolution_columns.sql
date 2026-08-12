-- Remove as colunas mortas da integração com a Evolution API.
--
-- Contexto: o servidor Evolution é ÚNICO para todo o sistema (mesma URL, mesma
-- API key global). O que separa um tenant do outro é a INSTÂNCIA — o número de
-- WhatsApp —, nunca o servidor.
--
-- 1. organizations.evolution_api_url / evolution_api_key
--    Resíduo de um desenho antigo de "um servidor Evolution por org". Nenhum
--    caminho do app as lê: a ordem era sempre `process.env.X || org.X`, e as
--    envs estão definidas na VPS, então as colunas nunca tiveram efeito. A
--    resolução do servidor agora vive em web/lib/evolution.ts.
--
-- 2. organization_settings.whatsapp_instance_name
--    Coluna duplicada. O mesmo dado existia em organizations.whatsapp_instance_name,
--    e os dois caminhos liam de lugares diferentes: o ENVIO lia settings, o
--    WEBHOOK DE ENTRADA casa a org por organizations. Uma org preenchida só de
--    um lado enviava por um número e recebia por outro. organizations passa a
--    ser a fonte única — é o que whatsapp-connect.ts grava ao conectar.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Backfill defensivo antes do drop
-- ---------------------------------------------------------------------------
-- Em produção a coluna está nula em todas as orgs, então isto não altera nada.
-- Existe para o caso de algum ambiente ter a instância preenchida apenas no
-- lado legado — sem isto, o drop perderia o vínculo com a instância.

UPDATE public.organizations o
SET whatsapp_instance_name = s.whatsapp_instance_name
FROM public.organization_settings s
WHERE s.organization_id = o.id
  AND o.whatsapp_instance_name IS NULL
  AND s.whatsapp_instance_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Drop
-- ---------------------------------------------------------------------------

ALTER TABLE public.organization_settings
  DROP COLUMN IF EXISTS whatsapp_instance_name;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS evolution_api_url,
  DROP COLUMN IF EXISTS evolution_api_key;

COMMIT;
