import { Database } from "@/utils/database.types"
export type AppointmentWithDetails = Database['public']['Tables']['appointments']['Row'] & {
  customer: Database['public']['Tables']['customers']['Row']
  service: Database['public']['Tables']['services']['Row']
  professional: Database['public']['Tables']['professionals']['Row']
}