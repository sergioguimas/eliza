import { createBrowserClient } from '@supabase/ssr'
import { Database } from "@/utils/database.types"

export function createClient<T = Database>() {
  return createBrowserClient<T>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}