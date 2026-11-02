/**
 * Generated from supabase/migrations by introspecting the schema (PGlite), in
 * the same shape as `supabase gen types typescript`. Regenerate with the
 * official CLI once a project is linked — it overwrites this file:
 *
 *   pnpm supabase gen types typescript --local > apps/web/src/lib/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      airports: {
        Row: {
          city: string | null
          city_ar: string | null
          company_id: string
          country_code: string | null
          created_at: string
          google_place_id: string | null
          iata: string | null
          icao: string | null
          id: string
          is_international: boolean | null
          lat: number
          lng: number
          name: string
          name_ar: string | null
          source: string | null
          terminals: string[] | null
        }
        Insert: {
          city?: string | null
          city_ar?: string | null
          company_id: string
          country_code?: string | null
          created_at?: string
          google_place_id?: string | null
          iata?: string | null
          icao?: string | null
          id?: string
          is_international?: boolean | null
          lat: number
          lng: number
          name: string
          name_ar?: string | null
          source?: string | null
          terminals?: string[] | null
        }
        Update: {
          city?: string | null
          city_ar?: string | null
          company_id?: string
          country_code?: string | null
          created_at?: string
          google_place_id?: string | null
          iata?: string | null
          icao?: string | null
          id?: string
          is_international?: boolean | null
          lat?: number
          lng?: number
          name?: string
          name_ar?: string | null
          source?: string | null
          terminals?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "airports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          country_code: string
          created_at: string
          default_language: Database["public"]["Enums"]["app_language"]
          id: string
          logo_url: string | null
          name: string
          name_ar: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          default_language?: Database["public"]["Enums"]["app_language"]
          id?: string
          logo_url?: string | null
          name: string
          name_ar?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          default_language?: Database["public"]["Enums"]["app_language"]
          id?: string
          logo_url?: string | null
          name?: string
          name_ar?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          ack_deadline_min: number
          airport_share_window_min: number
          company_id: string
          complete_prompt_after_min: number
          eastern_arabic_digits: boolean
          far_location_km: number
          flight_api_enabled: boolean
          grace_min: number
          location_interval_sec: number
          max_daily_driving_min: number
          no_show_after_min: number
          offline_alert_after_min: number
          reminder_offsets_min: number[]
          standard_day_min: number
          start_prompt_after_min: number
          updated_at: string
          weekend_days: number[]
          weekly_max_min: number
        }
        Insert: {
          ack_deadline_min?: number
          airport_share_window_min?: number
          company_id: string
          complete_prompt_after_min?: number
          eastern_arabic_digits?: boolean
          far_location_km?: number
          flight_api_enabled?: boolean
          grace_min?: number
          location_interval_sec?: number
          max_daily_driving_min?: number
          no_show_after_min?: number
          offline_alert_after_min?: number
          reminder_offsets_min?: number[]
          standard_day_min?: number
          start_prompt_after_min?: number
          updated_at?: string
          weekend_days?: number[]
          weekly_max_min?: number
        }
        Update: {
          ack_deadline_min?: number
          airport_share_window_min?: number
          company_id?: string
          complete_prompt_after_min?: number
          eastern_arabic_digits?: boolean
          far_location_km?: number
          flight_api_enabled?: boolean
          grace_min?: number
          location_interval_sec?: number
          max_daily_driving_min?: number
          no_show_after_min?: number
          offline_alert_after_min?: number
          reminder_offsets_min?: number[]
          standard_day_min?: number
          start_prompt_after_min?: number
          updated_at?: string
          weekend_days?: number[]
          weekly_max_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_availability: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string
          ends_at: string
          id: string
          note: string | null
          starts_at: string
          type: Database["public"]["Enums"]["availability_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id: string
          ends_at: string
          id?: string
          note?: string | null
          starts_at: string
          type: Database["public"]["Enums"]["availability_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string
          ends_at?: string
          id?: string
          note?: string | null
          starts_at?: string
          type?: Database["public"]["Enums"]["availability_type"]
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_day_summary: {
        Row: {
          company_id: string
          computed_at: string
          date: string
          distance_km: number
          driver_id: string
          driving_min: number
          first_start_at: string | null
          is_holiday: boolean
          is_weekend: boolean
          last_end_at: string | null
          overtime_min: number
          tasks_by_category: Json
          tasks_count: number
          working_min: number
        }
        Insert: {
          company_id: string
          computed_at?: string
          date: string
          distance_km?: number
          driver_id: string
          driving_min?: number
          first_start_at?: string | null
          is_holiday?: boolean
          is_weekend?: boolean
          last_end_at?: string | null
          overtime_min?: number
          tasks_by_category?: Json
          tasks_count?: number
          working_min?: number
        }
        Update: {
          company_id?: string
          computed_at?: string
          date?: string
          distance_km?: number
          driver_id?: string
          driving_min?: number
          first_start_at?: string | null
          is_holiday?: boolean
          is_weekend?: boolean
          last_end_at?: string | null
          overtime_min?: number
          tasks_by_category?: Json
          tasks_count?: number
          working_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_day_summary_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_day_summary_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy_m: number | null
          battery_pct: number | null
          company_id: string
          driver_id: string
          heading: number | null
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed_kmh: number | null
          task_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          battery_pct?: number | null
          company_id: string
          driver_id: string
          heading?: number | null
          id?: never
          lat: number
          lng: number
          recorded_at?: string
          speed_kmh?: number | null
          task_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          battery_pct?: number | null
          company_id?: string
          driver_id?: string
          heading?: number | null
          id?: never
          lat?: number
          lng?: number
          recorded_at?: string
          speed_kmh?: number | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          company_id: string
          created_at: string
          current_status: Database["public"]["Enums"]["driver_status"]
          employee_no: string | null
          full_name: string
          full_name_ar: string | null
          home_site_id: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          licence_expiry: string | null
          licence_no: string | null
          max_daily_driving_min: number | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          profile_id: string | null
          shift_end: string | null
          shift_start: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["driver_status"]
          employee_no?: string | null
          full_name: string
          full_name_ar?: string | null
          home_site_id?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          licence_expiry?: string | null
          licence_no?: string | null
          max_daily_driving_min?: number | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["driver_status"]
          employee_no?: string | null
          full_name?: string
          full_name_ar?: string | null
          home_site_id?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          licence_expiry?: string | null
          licence_no?: string | null
          max_daily_driving_min?: number | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_home_site_id_fkey"
            columns: ["home_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_details: {
        Row: {
          actual_time: string | null
          airline: string | null
          airport_id: string | null
          buffer_min: number
          direction: Database["public"]["Enums"]["flight_direction"]
          estimated_time: string | null
          flight_no: string | null
          flight_status: string | null
          provider_payload: Json | null
          scheduled_time: string
          task_id: string
          terminal: string | null
          updated_at: string
        }
        Insert: {
          actual_time?: string | null
          airline?: string | null
          airport_id?: string | null
          buffer_min?: number
          direction: Database["public"]["Enums"]["flight_direction"]
          estimated_time?: string | null
          flight_no?: string | null
          flight_status?: string | null
          provider_payload?: Json | null
          scheduled_time: string
          task_id: string
          terminal?: string | null
          updated_at?: string
        }
        Update: {
          actual_time?: string | null
          airline?: string | null
          airport_id?: string | null
          buffer_min?: number
          direction?: Database["public"]["Enums"]["flight_direction"]
          estimated_time?: string | null
          flight_no?: string | null
          flight_status?: string | null
          provider_payload?: Json | null
          scheduled_time?: string
          task_id?: string
          terminal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_details_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_details_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string
          date: string
          id: string
          name: string
          name_ar: string | null
        }
        Insert: {
          company_id: string
          date: string
          id?: string
          name: string
          name_ar?: string | null
        }
        Update: {
          company_id?: string
          date?: string
          id?: string
          name?: string
          name_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acted_at: string | null
          actions: Json
          body: string | null
          channels: Database["public"]["Enums"]["notification_channel"][]
          company_id: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          scheduled_for: string
          sent_at: string | null
          task_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          acted_at?: string | null
          actions?: Json
          body?: string | null
          channels?: Database["public"]["Enums"]["notification_channel"][]
          company_id: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          scheduled_for?: string
          sent_at?: string | null
          task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          acted_at?: string | null
          actions?: Json
          body?: string | null
          channels?: Database["public"]["Enums"]["notification_channel"][]
          company_id?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          scheduled_for?: string
          sent_at?: string | null
          task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          full_name_ar: string | null
          id: string
          is_active: boolean
          language: Database["public"]["Enums"]["app_language"]
          notif_email: boolean
          notif_in_app: boolean
          notif_push: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          full_name_ar?: string | null
          id: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["app_language"]
          notif_email?: boolean
          notif_in_app?: boolean
          notif_push?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          full_name_ar?: string | null
          id?: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["app_language"]
          notif_email?: boolean
          notif_in_app?: boolean
          notif_push?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_rules: {
        Row: {
          company_id: string
          created_at: string
          ends_on: string | null
          generated_until: string | null
          id: string
          is_active: boolean
          rrule: string
          starts_on: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ends_on?: string | null
          generated_until?: string | null
          id?: string
          is_active?: boolean
          rrule: string
          starts_on: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ends_on?: string | null
          generated_until?: string | null
          id?: string
          is_active?: boolean
          rrule?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      site_airports: {
        Row: {
          airport_id: string
          created_at: string
          default_buffer_min: number
          distance_km: number | null
          drive_minutes: number | null
          is_default: boolean
          site_id: string
        }
        Insert: {
          airport_id: string
          created_at?: string
          default_buffer_min?: number
          distance_km?: number | null
          drive_minutes?: number | null
          is_default?: boolean
          site_id: string
        }
        Update: {
          airport_id?: string
          created_at?: string
          default_buffer_min?: number
          distance_km?: number | null
          drive_minutes?: number | null
          is_default?: boolean
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_airports_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_airports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          address_ar: string | null
          city: string | null
          code: string | null
          company_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          google_place_id: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          name_ar: string | null
          notes: string | null
          type: Database["public"]["Enums"]["site_type"]
          updated_at: string
          work_end: string | null
          work_start: string | null
        }
        Insert: {
          address?: string | null
          address_ar?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          name_ar?: string | null
          notes?: string | null
          type?: Database["public"]["Enums"]["site_type"]
          updated_at?: string
          work_end?: string | null
          work_start?: string | null
        }
        Update: {
          address?: string | null
          address_ar?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          name_ar?: string | null
          notes?: string | null
          type?: Database["public"]["Enums"]["site_type"]
          updated_at?: string
          work_end?: string | null
          work_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          acknowledged_at: string | null
          assigned_at: string
          assigned_by: string | null
          decline_reason: string | null
          declined_at: string | null
          driver_id: string
          eta_next_stop_at: string | null
          eta_updated_at: string | null
          id: string
          is_primary: boolean
          task_id: string
          vehicle_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          driver_id: string
          eta_next_stop_at?: string | null
          eta_updated_at?: string | null
          id?: string
          is_primary?: boolean
          task_id: string
          vehicle_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          driver_id?: string
          eta_next_stop_at?: string | null
          eta_updated_at?: string | null
          id?: string
          is_primary?: boolean
          task_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          kind: string
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_conflicts: {
        Row: {
          created_at: string
          details: Json
          driver_id: string | null
          id: string
          other_task_id: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["conflict_severity"]
          task_id: string
          type: Database["public"]["Enums"]["conflict_type"]
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          driver_id?: string | null
          id?: string
          other_task_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["conflict_severity"]
          task_id: string
          type: Database["public"]["Enums"]["conflict_type"]
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          driver_id?: string | null
          id?: string
          other_task_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["conflict_severity"]
          task_id?: string
          type?: Database["public"]["Enums"]["conflict_type"]
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_conflicts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_conflicts_other_task_id_fkey"
            columns: ["other_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_conflicts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_conflicts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_delays: {
        Row: {
          created_at: string
          delay_min: number | null
          id: string
          new_estimated_start: string | null
          note: string | null
          previous_status: Database["public"]["Enums"]["task_status"]
          reason: Database["public"]["Enums"]["delay_reason"]
          reported_by: string | null
          resolved_at: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          delay_min?: number | null
          id?: string
          new_estimated_start?: string | null
          note?: string | null
          previous_status: Database["public"]["Enums"]["task_status"]
          reason: Database["public"]["Enums"]["delay_reason"]
          reported_by?: string | null
          resolved_at?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          delay_min?: number | null
          id?: string
          new_estimated_start?: string | null
          note?: string | null
          previous_status?: Database["public"]["Enums"]["task_status"]
          reason?: Database["public"]["Enums"]["delay_reason"]
          reported_by?: string | null
          resolved_at?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_delays_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_delays_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          actor_id: string | null
          client_ts: string | null
          company_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["task_status"] | null
          id: string
          lat: number | null
          lng: number | null
          payload: Json
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"] | null
          type: Database["public"]["Enums"]["task_event_type"]
        }
        Insert: {
          actor_id?: string | null
          client_ts?: string | null
          company_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          lat?: number | null
          lng?: number | null
          payload?: Json
          task_id: string
          to_status?: Database["public"]["Enums"]["task_status"] | null
          type: Database["public"]["Enums"]["task_event_type"]
        }
        Update: {
          actor_id?: string | null
          client_ts?: string | null
          company_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          lat?: number | null
          lng?: number | null
          payload?: Json
          task_id?: string
          to_status?: Database["public"]["Enums"]["task_status"] | null
          type?: Database["public"]["Enums"]["task_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          created_by: string | null
          related_task_id: string
          relation: Database["public"]["Enums"]["task_link_relation"]
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          related_task_id: string
          relation: Database["public"]["Enums"]["task_link_relation"]
          task_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          related_task_id?: string
          relation?: Database["public"]["Enums"]["task_link_relation"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_stops: {
        Row: {
          actual_arrival_at: string | null
          actual_departure_at: string | null
          address: string | null
          airport_id: string | null
          contact_name: string | null
          contact_phone: string | null
          dwell_min: number
          google_place_id: string | null
          id: string
          label: string | null
          lat: number | null
          leg_distance_km: number | null
          leg_duration_min: number | null
          lng: number | null
          notes: string | null
          planned_arrival_at: string | null
          seq: number
          site_id: string | null
          task_id: string
        }
        Insert: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          address?: string | null
          airport_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          dwell_min?: number
          google_place_id?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          leg_distance_km?: number | null
          leg_duration_min?: number | null
          lng?: number | null
          notes?: string | null
          planned_arrival_at?: string | null
          seq: number
          site_id?: string | null
          task_id: string
        }
        Update: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          address?: string | null
          airport_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          dwell_min?: number
          google_place_id?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          leg_distance_km?: number | null
          leg_duration_min?: number | null
          lng?: number | null
          notes?: string | null
          planned_arrival_at?: string | null
          seq?: number
          site_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_stops_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_stops_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_stops_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_distance_km: number | null
          actual_end_at: string | null
          actual_start_at: string | null
          cancel_reason: string | null
          category: Database["public"]["Enums"]["task_category"]
          company_id: string
          completion_notes: string | null
          conflicts_overridden: boolean
          created_at: string
          created_by: string | null
          description: string | null
          estimated_distance_km: number | null
          estimated_duration_min: number | null
          id: string
          metadata: Json
          odometer_end_km: number | null
          odometer_start_km: number | null
          override_by: string | null
          override_reason: string | null
          passengers: Json
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_date: string | null
          recurrence_rule_id: string | null
          remind_offsets_min: number[] | null
          requested_by: string | null
          scheduled_end: string | null
          scheduled_start: string
          site_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_distance_km?: number | null
          actual_end_at?: string | null
          actual_start_at?: string | null
          cancel_reason?: string | null
          category: Database["public"]["Enums"]["task_category"]
          company_id: string
          completion_notes?: string | null
          conflicts_overridden?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_distance_km?: number | null
          estimated_duration_min?: number | null
          id?: string
          metadata?: Json
          odometer_end_km?: number | null
          odometer_start_km?: number | null
          override_by?: string | null
          override_reason?: string | null
          passengers?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_date?: string | null
          recurrence_rule_id?: string | null
          remind_offsets_min?: number[] | null
          requested_by?: string | null
          scheduled_end?: string | null
          scheduled_start: string
          site_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_distance_km?: number | null
          actual_end_at?: string | null
          actual_start_at?: string | null
          cancel_reason?: string | null
          category?: Database["public"]["Enums"]["task_category"]
          company_id?: string
          completion_notes?: string | null
          conflicts_overridden?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_distance_km?: number | null
          estimated_duration_min?: number | null
          id?: string
          metadata?: Json
          odometer_end_km?: number | null
          odometer_start_km?: number | null
          override_by?: string | null
          override_reason?: string | null
          passengers?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_date?: string | null
          recurrence_rule_id?: string | null
          remind_offsets_min?: number[] | null
          requested_by?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          site_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_rule_id_fkey"
            columns: ["recurrence_rule_id"]
            isOneToOne: false
            referencedRelation: "recurrence_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sites: {
        Row: {
          site_id: string
          user_id: string
        }
        Insert: {
          site_id: string
          user_id: string
        }
        Update: {
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          make: string | null
          model: string | null
          notes: string | null
          odometer_km: number | null
          plate_no: string
          seats: number | null
          site_id: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          plate_no: string
          seats?: number | null
          site_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          plate_no?: string
          seats?: number | null
          site_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_driver_latest_location: {
        Row: {
          battery_pct: number | null
          company_id: string | null
          current_status: Database["public"]["Enums"]["driver_status"] | null
          driver_id: string | null
          full_name: string | null
          full_name_ar: string | null
          heading: number | null
          home_site_id: string | null
          last_seen_at: string | null
          lat: number | null
          lng: number | null
          recorded_at: string | null
          speed_kmh: number | null
          task_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_can_access_site: {
        Args: {
          p_site: string
        }
        Returns: boolean
      }
      auth_can_access_site_for: {
        Args: {
          p_user: string
          p_site: string
        }
        Returns: boolean
      }
      auth_can_edit_task: {
        Args: {
          p_task: string
        }
        Returns: boolean
      }
      auth_can_see_task: {
        Args: {
          p_task: string
        }
        Returns: boolean
      }
      auth_company_id: {
        Args: never
        Returns: string
      }
      auth_driver_id: {
        Args: never
        Returns: string
      }
      auth_is_admin: {
        Args: never
        Returns: boolean
      }
      auth_is_staff: {
        Args: never
        Returns: boolean
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      fn_check_task_conflicts: {
        Args: {
          p_task_id: string
          p_driver_id: string
          p_vehicle_id?: string
          p_start?: string
          p_end?: string
        }
        Returns: {
            type: Database["public"]["Enums"]["conflict_type"]
            severity: Database["public"]["Enums"]["conflict_severity"]
            other_task_id: string
            details: Json
          }[]
      }
      fn_distance_km: {
        Args: {
          lat1: number
          lng1: number
          lat2: number
          lng2: number
        }
        Returns: number
      }
      fn_plan_due_reminders: {
        Args: never
        Returns: number
      }
      fn_prune_locations: {
        Args: never
        Returns: undefined
      }
      fn_refresh_driver_day_summary: {
        Args: {
          p_driver: string
          p_date: string
        }
        Returns: undefined
      }
      fn_refresh_task_conflicts: {
        Args: {
          p_task_id: string
        }
        Returns: undefined
      }
      fn_similar_airport_trips: {
        Args: {
          p_airport_id: string
          p_time: string
          p_exclude_task?: string
        }
        Returns: {
            task_id: string
            site_id: string
            site_name: string
            direction: Database["public"]["Enums"]["flight_direction"]
            flight_no: string
            scheduled_time: string
            scheduled_start: string
            driver_name: string
            minutes_apart: number
          }[]
      }
      fn_task_effective_end: {
        Args: {
          p_task: string
        }
        Returns: string
      }
      fn_task_effective_start: {
        Args: {
          p_task: string
        }
        Returns: string
      }
      fn_task_watchdog: {
        Args: never
        Returns: undefined
      }
      rpc_report_location: {
        Args: {
          p_lat: number
          p_lng: number
          p_accuracy?: number
          p_speed_kmh?: number
          p_heading?: number
          p_battery?: number
          p_task_id?: string
          p_recorded_at?: string
        }
        Returns: undefined
      }
      rpc_task_transition: {
        Args: {
          p_task_id: string
          p_action: string
          p_payload?: Json
          p_event_id?: string
        }
        Returns: {
            actual_distance_km: number | null
            actual_end_at: string | null
            actual_start_at: string | null
            cancel_reason: string | null
            category: Database["public"]["Enums"]["task_category"]
            company_id: string
            completion_notes: string | null
            conflicts_overridden: boolean
            created_at: string
            created_by: string | null
            description: string | null
            estimated_distance_km: number | null
            estimated_duration_min: number | null
            id: string
            metadata: Json
            odometer_end_km: number | null
            odometer_start_km: number | null
            override_by: string | null
            override_reason: string | null
            passengers: Json
            priority: Database["public"]["Enums"]["task_priority"]
            recurrence_date: string | null
            recurrence_rule_id: string | null
            remind_offsets_min: number[] | null
            requested_by: string | null
            scheduled_end: string | null
            scheduled_start: string
            site_id: string
            status: Database["public"]["Enums"]["task_status"]
            title: string
            updated_at: string
          }
      }
    }
    Enums: {
      app_language:
        | "en"
        | "ar"
      app_role:
        | "owner"
        | "admin"
        | "dispatcher"
        | "driver"
        | "viewer"
      availability_type:
        | "leave"
        | "sick"
        | "off_day"
        | "training"
        | "other"
      conflict_severity:
        | "info"
        | "warning"
        | "blocking"
      conflict_type:
        | "driver_overlap"
        | "driver_multi_location_same_day"
        | "vehicle_overlap"
        | "driver_over_hours"
        | "outside_working_hours"
        | "driver_unavailable"
      delay_reason:
        | "flight_delayed"
        | "traffic"
        | "passenger_late"
        | "vehicle_issue"
        | "weather"
        | "other"
      driver_status:
        | "offline"
        | "idle"
        | "en_route"
        | "in_progress"
        | "delayed"
      flight_direction:
        | "arrival"
        | "departure"
      notification_channel:
        | "in_app"
        | "push"
        | "email"
      notification_type:
        | "task_assigned"
        | "task_reminder"
        | "task_start_prompt"
        | "task_complete_prompt"
        | "task_updated"
        | "task_cancelled"
        | "driver_not_acknowledged"
        | "task_not_started"
        | "task_delayed"
        | "task_completed"
        | "driver_no_show"
        | "driver_offline"
        | "airport_share_hint"
        | "conflict_detected"
        | "system"
      site_type:
        | "construction_site"
        | "office"
        | "warehouse"
        | "other"
      task_category:
        | "daily_routine"
        | "airport"
        | "document_delivery"
        | "escort"
      task_event_type:
        | "created"
        | "updated"
        | "assigned"
        | "unassigned"
        | "acknowledged"
        | "declined"
        | "reminder_sent"
        | "started"
        | "arrived"
        | "delayed"
        | "resumed"
        | "completed"
        | "cancelled"
        | "no_show"
        | "conflict_overridden"
        | "note_added"
        | "attachment_added"
        | "location_snapshot"
      task_link_relation:
        | "shared_ride"
        | "follow_up"
        | "return_trip"
        | "duplicate_of"
      task_priority:
        | "low"
        | "normal"
        | "high"
        | "urgent"
      task_status:
        | "draft"
        | "scheduled"
        | "assigned"
        | "acknowledged"
        | "en_route"
        | "in_progress"
        | "delayed"
        | "completed"
        | "cancelled"
        | "declined"
        | "no_show"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]

export type CompositeTypes<T extends keyof DefaultSchema["CompositeTypes"]> =
  DefaultSchema["CompositeTypes"][T]

export const Constants = {
  public: {
    Enums: {
      app_language: ["en", "ar"],
      app_role: ["owner", "admin", "dispatcher", "driver", "viewer"],
      availability_type: ["leave", "sick", "off_day", "training", "other"],
      conflict_severity: ["info", "warning", "blocking"],
      conflict_type: ["driver_overlap", "driver_multi_location_same_day", "vehicle_overlap", "driver_over_hours", "outside_working_hours", "driver_unavailable"],
      delay_reason: ["flight_delayed", "traffic", "passenger_late", "vehicle_issue", "weather", "other"],
      driver_status: ["offline", "idle", "en_route", "in_progress", "delayed"],
      flight_direction: ["arrival", "departure"],
      notification_channel: ["in_app", "push", "email"],
      notification_type: ["task_assigned", "task_reminder", "task_start_prompt", "task_complete_prompt", "task_updated", "task_cancelled", "driver_not_acknowledged", "task_not_started", "task_delayed", "task_completed", "driver_no_show", "driver_offline", "airport_share_hint", "conflict_detected", "system"],
      site_type: ["construction_site", "office", "warehouse", "other"],
      task_category: ["daily_routine", "airport", "document_delivery", "escort"],
      task_event_type: ["created", "updated", "assigned", "unassigned", "acknowledged", "declined", "reminder_sent", "started", "arrived", "delayed", "resumed", "completed", "cancelled", "no_show", "conflict_overridden", "note_added", "attachment_added", "location_snapshot"],
      task_link_relation: ["shared_ride", "follow_up", "return_trip", "duplicate_of"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["draft", "scheduled", "assigned", "acknowledged", "en_route", "in_progress", "delayed", "completed", "cancelled", "declined", "no_show"],
    },
  },
} as const
