import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/utils/database.types"

/**
 * Client que o domínio recebe por parâmetro: SERVICE ROLE. O RLS não escopa
 * nada aqui, então toda query do domínio filtra por `organization_id`.
 */
export type Db = SupabaseClient<Database>
