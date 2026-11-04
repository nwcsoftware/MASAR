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
          low_rating_threshold: number
          max_daily_driving_min: number
          no_show_after_min: number
          offline_alert_after_min: number
          passenger_email_domains: string[]
          passenger_join_code: string | null
          rating_edit_hours: number
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
          low_rating_threshold?: number
          max_daily_driving_min?: number
          no_show_after_min?: number
          offline_alert_after_min?: number
          passenger_email_domains?: string[]
          passenger_join_code?: string | null
          rating_edit_hours?: number
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
          low_rating_threshold?: number
          max_daily_driving_min?: number
          no_show_after_min?: number
          offline_alert_after_min?: number
          passenger_email_domains?: string[]
          passenger_join_code?: string | null
          rating_edit_hours?: number
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
      document_types: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          has_expiry: boolean
          id: string
          is_active: boolean
          is_driving_licence: boolean
          name: string
          name_ar: string | null
          remind_days: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          is_driving_licence?: boolean
          name: string
          name_ar?: string | null
          remind_days?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          is_driving_licence?: boolean
          name?: string
          name_ar?: string | null
          remind_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
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
      driver_documents: {
        Row: {
          company_id: string
          created_at: string
          document_no: string | null
          document_type_id: string
          driver_id: string
          expires_on: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          id: string
          issued_on: string
          notes: string | null
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_no?: string | null
          document_type_id: string
          driver_id: string
          expires_on?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          issued_on: string
          notes?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_no?: string | null
          document_type_id?: string
          driver_id?: string
          expires_on?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          issued_on?: string
          notes?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          english_rating: number | null
          full_name: string
          full_name_ar: string | null
          grade: number | null
          home_site_id: string | null
          id: string
          is_active: boolean
          job_title_id: string | null
          last_seen_at: string | null
          licence_expiry: string | null
          licence_no: string | null
          max_daily_driving_min: number | null
          nationality: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          profile_id: string | null
          serve_group_id: string | null
          shift_end: string | null
          shift_start: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["driver_status"]
          employee_no?: string | null
          english_rating?: number | null
          full_name: string
          full_name_ar?: string | null
          grade?: number | null
          home_site_id?: string | null
          id?: string
          is_active?: boolean
          job_title_id?: string | null
          last_seen_at?: string | null
          licence_expiry?: string | null
          licence_no?: string | null
          max_daily_driving_min?: number | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          serve_group_id?: string | null
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["driver_status"]
          employee_no?: string | null
          english_rating?: number | null
          full_name?: string
          full_name_ar?: string | null
          grade?: number | null
          home_site_id?: string | null
          id?: string
          is_active?: boolean
          job_title_id?: string | null
          last_seen_at?: string | null
          licence_expiry?: string | null
          licence_no?: string | null
          max_daily_driving_min?: number | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          serve_group_id?: string | null
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
          {
            foreignKeyName: "drivers_serve_group_id_fkey"
            columns: ["serve_group_id"]
            isOneToOne: false
            referencedRelation: "grade_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          person_id: string
          phone: string
          relation: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          person_id: string
          phone: string
          relation?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          person_id?: string
          phone?: string
          relation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
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
      grade_groups: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          max_grade: number
          min_grade: number
          name: string | null
          name_ar: string | null
          rank: number
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          max_grade: number
          min_grade: number
          name?: string | null
          name_ar?: string | null
          rank: number
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          max_grade?: number
          min_grade?: number
          name?: string | null
          name_ar?: string | null
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      job_title_documents: {
        Row: {
          document_type_id: string
          job_title_id: string
        }
        Insert: {
          document_type_id: string
          job_title_id: string
        }
        Update: {
          document_type_id?: string
          job_title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_title_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_title_documents_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_titles: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_titles_company_id_fkey"
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
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          accessibility_needs: string | null
          company_id: string
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          employee_no: string | null
          full_name: string
          full_name_ar: string | null
          grade: number | null
          id: string
          is_active: boolean
          job_title: string | null
          language: Database["public"]["Enums"]["app_language"]
          notes: string | null
          phone: string | null
          photo_url: string | null
          profile_id: string | null
          registration_note: string | null
          registration_status: string | null
          ride_preferences: string[]
          site_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          accessibility_needs?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          employee_no?: string | null
          full_name: string
          full_name_ar?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          language?: Database["public"]["Enums"]["app_language"]
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          registration_note?: string | null
          registration_status?: string | null
          ride_preferences?: string[]
          site_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          accessibility_needs?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          employee_no?: string | null
          full_name?: string
          full_name_ar?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          language?: Database["public"]["Enums"]["app_language"]
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          registration_note?: string | null
          registration_status?: string | null
          ride_preferences?: string[]
          site_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_profile_id_fkey"
            columns: ["profile_id"]
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
      rating_options: {
        Row: {
          alerts: boolean
          category: string
          code: string
          company_id: string
          id: string
          is_active: boolean
          label: string
          label_ar: string | null
          score: number | null
          sort: number
        }
        Insert: {
          alerts?: boolean
          category: string
          code: string
          company_id: string
          id?: string
          is_active?: boolean
          label: string
          label_ar?: string | null
          score?: number | null
          sort?: number
        }
        Update: {
          alerts?: boolean
          category?: string
          code?: string
          company_id?: string
          id?: string
          is_active?: boolean
          label?: string
          label_ar?: string | null
          score?: number | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "rating_options_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          is_active: boolean
          is_default: boolean
          site_id: string
        }
        Insert: {
          airport_id: string
          created_at?: string
          default_buffer_min?: number
          distance_km?: number | null
          drive_minutes?: number | null
          is_active?: boolean
          is_default?: boolean
          site_id: string
        }
        Update: {
          airport_id?: string
          created_at?: string
          default_buffer_min?: number
          distance_km?: number | null
          drive_minutes?: number | null
          is_active?: boolean
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
      sos_events: {
        Row: {
          accuracy_m: number | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          company_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          location_at: string | null
          message: string | null
          person_id: string
          raised_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          task_id: string
        }
        Insert: {
          accuracy_m?: number | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_at?: string | null
          message?: string | null
          person_id: string
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          task_id: string
        }
        Update: {
          accuracy_m?: number | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_at?: string | null
          message?: string | null
          person_id?: string
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
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
          category: string
          created_at: string
          expires_on: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          id: string
          kind: string
          storage_path: string | null
          task_id: string
          title: string | null
          uploaded_by: string | null
          visible_to_passengers: boolean
        }
        Insert: {
          caption?: string | null
          category?: string
          created_at?: string
          expires_on?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          kind?: string
          storage_path?: string | null
          task_id: string
          title?: string | null
          uploaded_by?: string | null
          visible_to_passengers?: boolean
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string
          expires_on?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          kind?: string
          storage_path?: string | null
          task_id?: string
          title?: string | null
          uploaded_by?: string | null
          visible_to_passengers?: boolean
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
      task_passengers: {
        Row: {
          checked_in_at: string | null
          checkin_code: string | null
          company_id: string
          created_at: string
          dropoff_stop_seq: number | null
          dropped_off_at: string | null
          id: string
          name: string
          person_id: string | null
          pickup_order: number
          pickup_stop_seq: number | null
          task_id: string
        }
        Insert: {
          checked_in_at?: string | null
          checkin_code?: string | null
          company_id: string
          created_at?: string
          dropoff_stop_seq?: number | null
          dropped_off_at?: string | null
          id?: string
          name: string
          person_id?: string | null
          pickup_order: number
          pickup_stop_seq?: number | null
          task_id: string
        }
        Update: {
          checked_in_at?: string | null
          checkin_code?: string | null
          company_id?: string
          created_at?: string
          dropoff_stop_seq?: number | null
          dropped_off_at?: string | null
          id?: string
          name?: string
          person_id?: string | null
          pickup_order?: number
          pickup_stop_seq?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_passengers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_passengers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_passengers_task_id_fkey"
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
      trip_rating_choices: {
        Row: {
          option_id: string
          rating_id: string
        }
        Insert: {
          option_id: string
          rating_id: string
        }
        Update: {
          option_id?: string
          rating_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_rating_choices_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "rating_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_rating_choices_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "trip_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_ratings: {
        Row: {
          comment: string | null
          company_id: string
          created_at: string
          driver_id: string | null
          editable_until: string
          id: string
          is_low: boolean
          person_id: string
          photo_paths: string[]
          stars: number
          task_id: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          comment?: string | null
          company_id: string
          created_at?: string
          driver_id?: string | null
          editable_until: string
          id?: string
          is_low?: boolean
          person_id: string
          photo_paths?: string[]
          stars: number
          task_id: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          comment?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string | null
          editable_until?: string
          id?: string
          is_low?: boolean
          person_id?: string
          photo_paths?: string[]
          stars?: number
          task_id?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_ratings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_ratings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_ratings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_ratings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_requests: {
        Row: {
          company_id: string
          created_at: string
          created_task_id: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          dropoff: string | null
          id: string
          kind: string
          notes: string | null
          passengers_count: number
          person_id: string
          pickup: string | null
          requested_by: string | null
          requested_start: string | null
          site_id: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_task_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          dropoff?: string | null
          id?: string
          kind: string
          notes?: string | null
          passengers_count?: number
          person_id: string
          pickup?: string | null
          requested_by?: string | null
          requested_start?: string | null
          site_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_task_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          dropoff?: string | null
          id?: string
          kind?: string
          notes?: string | null
          passengers_count?: number
          person_id?: string
          pickup?: string | null
          requested_by?: string | null
          requested_start?: string | null
          site_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_created_task_id_fkey"
            columns: ["created_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_share_links: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          person_id: string
          revoked_at: string | null
          task_id: string
          token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          person_id: string
          revoked_at?: string | null
          task_id: string
          token?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          person_id?: string
          revoked_at?: string | null
          task_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_share_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_share_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_share_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
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
          grade_group_id: string | null
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
          grade_group_id?: string | null
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
          grade_group_id?: string | null
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
          {
            foreignKeyName: "vehicles_grade_group_id_fkey"
            columns: ["grade_group_id"]
            isOneToOne: false
            referencedRelation: "grade_groups"
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
      auth_is_platform_admin: {
        Args: never
        Returns: boolean
      }
      auth_is_passenger: {
        Args: never
        Returns: boolean
      }
      auth_is_staff: {
        Args: never
        Returns: boolean
      }
      auth_person_id: {
        Args: never
        Returns: string
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      auth_user_in_company: {
        Args: {
          p_user: string
        }
        Returns: boolean
      }
      fn_conflict_gate: {
        Args: {
          p_task_id: string
          p_override_reason: string
        }
        Returns: undefined
      }
      fn_conflicts_for: {
        Args: {
          p_company: string
          p_driver_id: string
          p_vehicle_id: string
          p_start: string
          p_end: string
          p_first_lat?: number
          p_first_lng?: number
          p_exclude_task?: string
        }
        Returns: {
            type: Database["public"]["Enums"]["conflict_type"]
            severity: Database["public"]["Enums"]["conflict_severity"]
            other_task_id: string
            details: Json
          }[]
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
      fn_document_reminders: {
        Args: never
        Returns: number
      }
      fn_driver_rating: {
        Args: {
          p_driver_id: string
        }
        Returns: {
            ratings: number
            stars: number
            driving: number
          }[]
      }
      fn_grade_conflicts: {
        Args: {
          p_company: string
          p_passengers: Json
          p_vehicle_id: string
          p_driver_id: string
        }
        Returns: {
            type: Database["public"]["Enums"]["conflict_type"]
            severity: Database["public"]["Enums"]["conflict_severity"]
            other_task_id: string
            details: Json
          }[]
      }
      fn_grade_group: {
        Args: {
          p_company: string
          p_grade: number
        }
        Returns: string
      }
      fn_passenger_can_read_attachment: {
        Args: {
          p_path: string
        }
        Returns: boolean
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
      fn_set_primary_driver: {
        Args: {
          p_task_id: string
          p_driver_id: string
          p_vehicle_id: string
        }
        Returns: undefined
      }
      fn_share_grade_check: {
        Args: {
          p_task_id: string
          p_host_task_id: string
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
            passenger_groups: string[]
            vehicle_group: string
          }[]
      }
      fn_snapshot_passengers: {
        Args: {
          p_company: string
          p_passengers: Json
        }
        Returns: Json
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
      rpc_import_people: {
        Args: {
          p_rows: Json
        }
        Returns: Json
      }
      rpc_override_task_conflicts: {
        Args: {
          p_task_id: string
          p_reason: string
        }
        Returns: undefined
      }
      rpc_create_share_link: {
        Args: {
          p_task_id: string
        }
        Returns: string
      }
      rpc_decide_request: {
        Args: {
          p_request_id: string
          p_approve: boolean
          p_note?: string
          p_created_task_id?: string
          p_override_reason?: string
        }
        Returns: undefined
      }
      rpc_driver_check_in: {
        Args: {
          p_task_id: string
          p_code: string
          p_lat?: number
          p_lng?: number
          p_task_passenger_id?: string
        }
        Returns: Json
      }
      rpc_driver_drop_off: {
        Args: {
          p_task_passenger_id: string
          p_lat?: number
          p_lng?: number
        }
        Returns: Json
      }
      rpc_passenger_live: {
        Args: {
          p_task_id: string
        }
        Returns: Json
      }
      rpc_passenger_request: {
        Args: {
          p: Json
        }
        Returns: string
      }
      rpc_passenger_sos: {
        Args: {
          p_task_id: string
          p_lat?: number
          p_lng?: number
          p_accuracy?: number
          p_message?: string
        }
        Returns: Json
      }
      rpc_revoke_share_link: {
        Args: {
          p_task_id: string
        }
        Returns: undefined
      }
      rpc_shared_trip: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
      rpc_sos_update: {
        Args: {
          p_sos_id: string
          p_action: string
          p_note?: string
        }
        Returns: undefined
      }
      rpc_withdraw_request: {
        Args: {
          p_request_id: string
        }
        Returns: undefined
      }
      rpc_passenger_home: {
        Args: never
        Returns: Json
      }
      rpc_passenger_register: {
        Args: {
          p_full_name: string
          p_phone?: string
          p_employee_no?: string
          p_join_code?: string
          p_language?: string
        }
        Returns: string
      }
      rpc_preview_grade_conflicts: {
        Args: {
          p_passengers: Json
          p_vehicle_id?: string
          p_driver_id?: string
        }
        Returns: {
            type: Database["public"]["Enums"]["conflict_type"]
            severity: Database["public"]["Enums"]["conflict_severity"]
            other_task_id: string
            details: Json
          }[]
      }
      rpc_preview_task_conflicts: {
        Args: {
          p_driver_ids: string[]
          p_start: string
          p_end: string
          p_vehicle_id?: string
          p_first_lat?: number
          p_first_lng?: number
          p_exclude_task?: string
        }
        Returns: {
            driver_id: string
            type: Database["public"]["Enums"]["conflict_type"]
            severity: Database["public"]["Enums"]["conflict_severity"]
            other_task_id: string
            details: Json
          }[]
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
      rpc_platform_companies: {
        Args: never
        Returns: {
          id: string
          name: string
          name_ar: string | null
          country_code: string
          timezone: string
          default_language: Database["public"]["Enums"]["app_language"]
          created_at: string
          owner_id: string | null
          owner_name: string | null
          owner_email: string | null
          owner_pending: boolean | null
          site_count: number
          user_count: number
        }[]
      }
      rpc_platform_create_company: {
        Args: {
          p_name: string
          p_name_ar?: string
          p_country_code?: string
          p_timezone?: string
          p_default_language?: Database["public"]["Enums"]["app_language"]
        }
        Returns: {
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
      }
      rpc_reschedule_task: {
        Args: {
          p_task_id: string
          p_start: string
          p_driver_id?: string
          p_change_driver?: boolean
          p_override_reason?: string
        }
        Returns: undefined
      }
      rpc_save_task: {
        Args: {
          p_task: Json
        }
        Returns: string
      }
      rpc_review_registration: {
        Args: {
          p_person_id: string
          p_approve: boolean
          p_note?: string
        }
        Returns: undefined
      }
      rpc_save_job_title: {
        Args: {
          p_title: Json
        }
        Returns: string
      }
      rpc_set_grade_groups: {
        Args: {
          p_groups: Json
        }
        Returns: {
            code: string
            company_id: string
            created_at: string
            id: string
            max_grade: number
            min_grade: number
            name: string | null
            name_ar: string | null
            rank: number
          }[]
      }
      rpc_set_site_airports: {
        Args: {
          p_site_id: string
          p_airports: Json
        }
        Returns: {
            airport_id: string
            created_at: string
            default_buffer_min: number
            distance_km: number | null
            drive_minutes: number | null
            is_default: boolean
            site_id: string
          }[]
      }
      rpc_share_trip: {
        Args: {
          p_task_id: string
          p_host_task_id: string
        }
        Returns: undefined
      }
      rpc_submit_rating: {
        Args: {
          p_task_id: string
          p_stars: number
          p_option_ids?: string[]
          p_comment?: string
          p_photo_paths?: string[]
        }
        Returns: string
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
      rpc_update_my_profile: {
        Args: {
          p: Json
        }
        Returns: undefined
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
        | "passenger"
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
        | "grade_mixed"
        | "vehicle_grade_mismatch"
        | "driver_grade_not_allowed"
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
        | "document_expiring"
        | "document_expired"
        | "passenger_registered"
        | "registration_approved"
        | "registration_rejected"
        | "low_rating"
        | "passenger_trip_assigned"
        | "driver_changed"
        | "driver_on_the_way"
        | "driver_arrived"
        | "trip_document_added"
        | "sos_alert"
        | "trip_request"
        | "trip_request_decided"
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
      app_role: ["owner", "admin", "dispatcher", "driver", "viewer", "passenger"],
      availability_type: ["leave", "sick", "off_day", "training", "other"],
      conflict_severity: ["info", "warning", "blocking"],
      conflict_type: ["driver_overlap", "driver_multi_location_same_day", "vehicle_overlap", "driver_over_hours", "outside_working_hours", "driver_unavailable", "grade_mixed", "vehicle_grade_mismatch", "driver_grade_not_allowed"],
      delay_reason: ["flight_delayed", "traffic", "passenger_late", "vehicle_issue", "weather", "other"],
      driver_status: ["offline", "idle", "en_route", "in_progress", "delayed"],
      flight_direction: ["arrival", "departure"],
      notification_channel: ["in_app", "push", "email"],
      notification_type: ["task_assigned", "task_reminder", "task_start_prompt", "task_complete_prompt", "task_updated", "task_cancelled", "driver_not_acknowledged", "task_not_started", "task_delayed", "task_completed", "driver_no_show", "driver_offline", "airport_share_hint", "conflict_detected", "system", "document_expiring", "document_expired", "passenger_registered", "registration_approved", "registration_rejected", "low_rating", "passenger_trip_assigned", "driver_changed", "driver_on_the_way", "driver_arrived", "trip_document_added", "sos_alert", "trip_request", "trip_request_decided"],
      site_type: ["construction_site", "office", "warehouse", "other"],
      task_category: ["daily_routine", "airport", "document_delivery", "escort"],
      task_event_type: ["created", "updated", "assigned", "unassigned", "acknowledged", "declined", "reminder_sent", "started", "arrived", "delayed", "resumed", "completed", "cancelled", "no_show", "conflict_overridden", "note_added", "attachment_added", "location_snapshot"],
      task_link_relation: ["shared_ride", "follow_up", "return_trip", "duplicate_of"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["draft", "scheduled", "assigned", "acknowledged", "en_route", "in_progress", "delayed", "completed", "cancelled", "declined", "no_show"],
    },
  },
} as const
