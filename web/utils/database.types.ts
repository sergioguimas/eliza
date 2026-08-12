export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointment_logs: {
        Row: {
          action: string | null
          appointment_id: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          push_name: string | null
          raw_message: string | null
          source: string | null
        }
        Insert: {
          action?: string | null
          appointment_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          push_name?: string | null
          raw_message?: string | null
          source?: string | null
        }
        Update: {
          action?: string | null
          appointment_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          push_name?: string | null
          raw_message?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          customer_id: string
          end_time: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          price: number | null
          professional_id: string | null
          reminder_morning_sent_at: string | null
          reminder_sent_at: string | null
          service_id: string | null
          start_time: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          end_time: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          professional_id?: string | null
          reminder_morning_sent_at?: string | null
          reminder_sent_at?: string | null
          service_id?: string | null
          start_time: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          professional_id?: string | null
          reminder_morning_sent_at?: string | null
          reminder_sent_at?: string | null
          service_id?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean | null
          address: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          document_normalized: string | null
          email: string | null
          gender: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string
          phone_normalized: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          document_normalized?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          phone_normalized?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          document_normalized?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          phone_normalized?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_interactions: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          niche: string | null
          organization_id: string | null
          step_number: number | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          niche?: string | null
          organization_id?: string | null
          step_number?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          niche?: string | null
          organization_id?: string | null
          step_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_leads: {
        Row: {
          contact: string
          created_at: string
          id: string
          metadata: Json | null
          name: string
          niche: string | null
          organization_id: string | null
          source: string
        }
        Insert: {
          contact: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          niche?: string | null
          organization_id?: string | null
          source?: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          niche?: string | null
          organization_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_rate_limits: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      demo_timeline_events: {
        Row: {
          appointment_id: string | null
          created_at: string
          delivered_for_real: boolean
          event_type: string
          id: string
          message_text: string | null
          organization_id: string
          response_text: string | null
          simulated_time: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          delivered_for_real?: boolean
          event_type: string
          id?: string
          message_text?: string | null
          organization_id: string
          response_text?: string | null
          simulated_time: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          delivered_for_real?: boolean
          event_type?: string
          id?: string
          message_text?: string | null
          organization_id?: string
          response_text?: string | null
          simulated_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_timeline_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_timeline_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          created_at: string | null
          customer_id: string
          expiration_date: string | null
          id: string
          items: Json
          notes: string | null
          organization_id: string
          professional_id: string | null
          status: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          expiration_date?: string | null
          id?: string
          items: Json
          notes?: string | null
          organization_id: string
          professional_id?: string | null
          status?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          expiration_date?: string | null
          id?: string
          items?: Json
          notes?: string | null
          organization_id?: string
          professional_id?: string | null
          status?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string
          due_date: string
          id: string
          organization_id: string | null
          payment_date: string | null
          status: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          organization_id?: string | null
          payment_date?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          organization_id?: string | null
          payment_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          organization_id: string
          role: string
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          organization_id: string
          role?: string
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          role?: string
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dispatches: {
        Row: {
          appointment_id: string | null
          created_at: string
          customer_id: string | null
          dispatch_date: string
          id: string
          kind: string
          organization_id: string
          payload: Json | null
          professional_id: string | null
          reference_time: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          dispatch_date: string
          id?: string
          kind: string
          organization_id: string
          payload?: Json | null
          professional_id?: string | null
          reference_time?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          dispatch_date?: string
          id?: string
          kind?: string
          organization_id?: string
          payload?: Json | null
          professional_id?: string | null
          reference_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_dispatches_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_dispatches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_dispatches_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          appointment_duration: number | null
          created_at: string | null
          days_of_week: number[] | null
          lunch_end: string | null
          lunch_start: string | null
          msg_appointment_canceled: string | null
          msg_appointment_created: string | null
          msg_appointment_pending: string | null
          msg_appointment_reminder: string | null
          msg_doctor_daily_summary: string | null
          open_hours_end: string | null
          open_hours_start: string | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          appointment_duration?: number | null
          created_at?: string | null
          days_of_week?: number[] | null
          lunch_end?: string | null
          lunch_start?: string | null
          msg_appointment_canceled?: string | null
          msg_appointment_created?: string | null
          msg_appointment_pending?: string | null
          msg_appointment_reminder?: string | null
          msg_doctor_daily_summary?: string | null
          open_hours_end?: string | null
          open_hours_start?: string | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          appointment_duration?: number | null
          created_at?: string | null
          days_of_week?: number[] | null
          lunch_end?: string | null
          lunch_start?: string | null
          msg_appointment_canceled?: string | null
          msg_appointment_created?: string | null
          msg_appointment_pending?: string | null
          msg_appointment_reminder?: string | null
          msg_doctor_daily_summary?: string | null
          open_hours_end?: string | null
          open_hours_start?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_demo: boolean
          name: string
          niche: string
          plan: string | null
          slug: string
          stripe_customer_id: string | null
          subscription_status: string | null
          updated_at: string | null
          whatsapp_instance_name: string | null
          whatsapp_status: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_demo?: boolean
          name: string
          niche: string
          plan?: string | null
          slug: string
          stripe_customer_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          whatsapp_instance_name?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          niche?: string
          plan?: string | null
          slug?: string
          stripe_customer_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          whatsapp_instance_name?: string | null
          whatsapp_status?: string | null
        }
        Relationships: []
      }
      professional_availability: {
        Row: {
          break_end: string | null
          break_start: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          professional_id: string
          start_time: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          professional_id: string
          start_time: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          professional_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          license_number: string | null
          name: string
          organization_id: string
          phone: string | null
          specialty: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name: string
          organization_id: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          color: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          professional_license: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          professional_license?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          professional_license?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_records: {
        Row: {
          appointment_id: string | null
          content: string
          created_at: string
          created_by_profile_id: string | null
          customer_id: string
          id: string
          organization_id: string
          professional_id: string | null
          signature_hash: string | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          updated_by_profile_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          content: string
          created_at?: string
          created_by_profile_id?: string | null
          customer_id: string
          id?: string
          organization_id: string
          professional_id?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by_profile_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          content?: string
          created_at?: string
          created_by_profile_id?: string | null
          customer_id?: string
          id?: string
          organization_id?: string
          professional_id?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          organization_id: string
          price: number | null
          title: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          organization_id: string
          price?: number | null
          title: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          organization_id?: string
          price?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalize_service_record: {
        Args: { p_service_record_id: string }
        Returns: {
          appointment_id: string | null
          content: string
          created_at: string
          created_by_profile_id: string | null
          customer_id: string
          id: string
          organization_id: string
          professional_id: string | null
          signature_hash: string | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          updated_by_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_or_create_public_customer: {
        Args: {
          p_address?: string
          p_birth_date?: string
          p_document?: string
          p_email?: string
          p_gender?: string
          p_name: string
          p_notes?: string
          p_organization_id: string
          p_phone: string
        }
        Returns: {
          active: boolean | null
          address: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          document_normalized: string | null
          email: string | null
          gender: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string
          phone_normalized: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_org_id: { Args: never; Returns: string }
      request_public_appointment: {
        Args: {
          p_address?: string
          p_appointment_notes?: string
          p_birth_date?: string
          p_document?: string
          p_email?: string
          p_gender?: string
          p_name: string
          p_notes?: string
          p_organization_id: string
          p_phone: string
          p_professional_id: string
          p_service_id: string
          p_start_time: string
        }
        Returns: {
          created_at: string
          customer_id: string
          end_time: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          price: number | null
          professional_id: string | null
          reminder_morning_sent_at: string | null
          reminder_sent_at: string | null
          service_id: string | null
          start_time: string
          status: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_service_record: {
        Args: { p_service_record_id: string }
        Returns: {
          appointment_id: string | null
          content: string
          created_at: string
          created_by_profile_id: string | null
          customer_id: string
          id: string
          organization_id: string
          professional_id: string | null
          signature_hash: string | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          updated_by_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
