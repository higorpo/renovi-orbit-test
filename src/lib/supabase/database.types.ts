export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      client_addresses: {
        Row: {
          city_id: string
          client_id: string
          complement: string | null
          created_at: string
          geohash: string | null
          h3_index: string | null
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          latitude: number | null
          location: unknown
          longitude: number | null
          neighborhood: string
          number: string
          state_id: string
          street: string
          updated_at: string
          zip_code: string
        }
        Insert: {
          city_id: string
          client_id: string
          complement?: string | null
          created_at?: string
          geohash?: string | null
          h3_index?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          neighborhood: string
          number: string
          state_id: string
          street: string
          updated_at?: string
          zip_code: string
        }
        Update: {
          city_id?: string
          client_id?: string
          complement?: string | null
          created_at?: string
          geohash?: string | null
          h3_index?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          neighborhood?: string
          number?: string
          state_id?: string
          street?: string
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "platform_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_addresses_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "platform_states"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles_private: {
        Row: {
          client_id: string
          cpf: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          cpf?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          cpf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_private_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ai_prompt_usage: {
        Row: {
          error_message: string | null
          generation_time_ms: number | null
          id: string
          prompt_id: string
          request_id: string | null
          session_id: string | null
          success: boolean
          tokens_used: number | null
          used_at: string
          user_id: string | null
        }
        Insert: {
          error_message?: string | null
          generation_time_ms?: number | null
          id?: string
          prompt_id: string
          request_id?: string | null
          session_id?: string | null
          success?: boolean
          tokens_used?: number | null
          used_at?: string
          user_id?: string | null
        }
        Update: {
          error_message?: string | null
          generation_time_ms?: number | null
          id?: string
          prompt_id?: string
          request_id?: string | null
          session_id?: string | null
          success?: boolean
          tokens_used?: number | null
          used_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_ai_prompt_usage_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "platform_ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ai_prompt_usage_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ai_prompts: {
        Row: {
          created_at: string
          created_by: string | null
          formatting_rules: Json
          id: string
          impact_description: string
          impact_location: string
          is_active: boolean
          max_tokens: number
          name: string
          prompt_key: string
          system_prompt: string
          temperature: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          formatting_rules?: Json
          id?: string
          impact_description?: string
          impact_location?: string
          is_active?: boolean
          max_tokens?: number
          name: string
          prompt_key: string
          system_prompt: string
          temperature?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          formatting_rules?: Json
          id?: string
          impact_description?: string
          impact_location?: string
          is_active?: boolean
          max_tokens?: number
          name?: string
          prompt_key?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      platform_cities: {
        Row: {
          created_at: string
          ibge_code: number
          id: string
          is_active: boolean
          name: string
          state_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ibge_code: number
          id?: string
          is_active?: boolean
          name: string
          state_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ibge_code?: number
          id?: string
          is_active?: boolean
          name?: string
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "platform_states"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_constants: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      platform_forms: {
        Row: {
          created_at: string
          description: string | null
          form_schema: Json
          form_status: string
          form_version: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          form_schema: Json
          form_status?: string
          form_version?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          form_schema?: Json
          form_status?: string
          form_version?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_neighborhoods: {
        Row: {
          city_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_neighborhoods_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "platform_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_rate_limits: {
        Row: {
          blocked_until: string | null
          burst_count: number
          count: number
          key: string
          reset_at: number
          updated_at: string | null
        }
        Insert: {
          blocked_until?: string | null
          burst_count?: number
          count?: number
          key: string
          reset_at: number
          updated_at?: string | null
        }
        Update: {
          blocked_until?: string | null
          burst_count?: number
          count?: number
          key?: string
          reset_at?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_services: {
        Row: {
          active: boolean
          ai_prompt_id: string | null
          color_key: string | null
          created_at: string
          description: string | null
          form_id: string | null
          icon_key: string | null
          id: string
          image_url: string | null
          parent_id: string | null
          show_on_request_quote: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_prompt_id?: string | null
          color_key?: string | null
          created_at?: string
          description?: string | null
          form_id?: string | null
          icon_key?: string | null
          id?: string
          image_url?: string | null
          parent_id?: string | null
          show_on_request_quote?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_prompt_id?: string | null
          color_key?: string | null
          created_at?: string
          description?: string | null
          form_id?: string | null
          icon_key?: string | null
          id?: string
          image_url?: string | null
          parent_id?: string | null
          show_on_request_quote?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_services_ai_prompt_id_fkey"
            columns: ["ai_prompt_id"]
            isOneToOne: false
            referencedRelation: "platform_ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_services_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "platform_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_services_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "platform_services"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_states: {
        Row: {
          abbreviation: string
          created_at: string
          ibge_code: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          ibge_code: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          ibge_code?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          profile_image_path: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          profile_image_path?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          profile_image_path?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_offered_services: {
        Row: {
          provider_id: string
          service_id: string
          sort_order: number
        }
        Insert: {
          provider_id: string
          service_id: string
          sort_order?: number
        }
        Update: {
          provider_id?: string
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_offered_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_offered_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "platform_services"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_portfolio_items: {
        Row: {
          city_region: string | null
          created_at: string
          description: string | null
          execution_date: string | null
          featured: boolean
          id: string
          image_paths: string[]
          provider_id: string
          service_id: string | null
          sort_order: number
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          city_region?: string | null
          created_at?: string
          description?: string | null
          execution_date?: string | null
          featured?: boolean
          id?: string
          image_paths?: string[]
          provider_id: string
          service_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          city_region?: string | null
          created_at?: string
          description?: string | null
          execution_date?: string | null
          featured?: boolean
          id?: string
          image_paths?: string[]
          provider_id?: string
          service_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_portfolio_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_portfolio_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "platform_services"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_profiles_private: {
        Row: {
          cnpj: string | null
          commercial_contact: string | null
          cpf: string | null
          entity_type: string
          legal_representative_cpf: string | null
          legal_representative_name: string | null
          nome_fantasia: string | null
          provider_id: string
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          commercial_contact?: string | null
          cpf?: string | null
          entity_type?: string
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          nome_fantasia?: string | null
          provider_id: string
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          commercial_contact?: string | null
          cpf?: string | null
          entity_type?: string
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          nome_fantasia?: string | null
          provider_id?: string
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_profiles_private_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_profiles_public: {
        Row: {
          bio: string | null
          display_name: string | null
          profile_visibility: string
          provider_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          display_name?: string | null
          profile_visibility?: string
          provider_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          display_name?: string | null
          profile_visibility?: string
          provider_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_profiles_public_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_proposals: {
        Row: {
          client_rejection_response: string | null
          client_response_deadline_at: string | null
          created_at: string
          final_amount: number
          id: string
          photos: string[]
          pricing_signature: string
          proposal_description: string
          proposal_duration_unit: string
          proposal_duration_value: number
          proposal_suggested_slots: Json
          proposed_amount: number
          provider_id: string
          service_request_id: string
          status: string
          tax_amount: number
          tax_rate: number
          updated_at: string
        }
        Insert: {
          client_rejection_response?: string | null
          client_response_deadline_at?: string | null
          created_at?: string
          final_amount: number
          id?: string
          photos?: string[]
          pricing_signature: string
          proposal_description: string
          proposal_duration_unit: string
          proposal_duration_value: number
          proposal_suggested_slots?: Json
          proposed_amount: number
          provider_id: string
          service_request_id: string
          status?: string
          tax_amount: number
          tax_rate: number
          updated_at?: string
        }
        Update: {
          client_rejection_response?: string | null
          client_response_deadline_at?: string | null
          created_at?: string
          final_amount?: number
          id?: string
          photos?: string[]
          pricing_signature?: string
          proposal_description?: string
          proposal_duration_unit?: string
          proposal_duration_value?: number
          proposal_suggested_slots?: Json
          proposed_amount?: number
          provider_id?: string
          service_request_id?: string
          status?: string
          tax_amount?: number
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_proposals_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_proposals_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_service_area_neighborhoods: {
        Row: {
          neighborhood_id: string
          provider_id: string
        }
        Insert: {
          neighborhood_id: string
          provider_id: string
        }
        Update: {
          neighborhood_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_service_area_neighborhoods_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "platform_neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_area_neighborhoods_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles_public"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      provider_service_request_questions: {
        Row: {
          client_responded_at: string | null
          client_response: string | null
          client_response_images: string[]
          created_at: string
          id: string
          provider_id: string
          question: string
          service_request_id: string
          updated_at: string
        }
        Insert: {
          client_responded_at?: string | null
          client_response?: string | null
          client_response_images?: string[]
          created_at?: string
          id?: string
          provider_id: string
          question: string
          service_request_id: string
          updated_at?: string
        }
        Update: {
          client_responded_at?: string | null
          client_response?: string | null
          client_response_images?: string[]
          created_at?: string
          id?: string
          provider_id?: string
          question?: string
          service_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_service_request_questions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_request_questions_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          address_id: string | null
          client_id: string
          created_at: string
          description: string | null
          estimated_duration_hint: string | null
          form_data: Json | null
          form_schema: Json | null
          form_version: string | null
          geohash: string | null
          h3_index: string | null
          id: string
          latitude: number | null
          location: unknown
          longitude: number | null
          missing_info_warnings: string[] | null
          photos: string[] | null
          scope_complexity: string | null
          service_id: string
          status: string
          suggested_equipment: string[] | null
          suggested_materials: string[] | null
          suggested_questions: string[] | null
          tags: string[] | null
          title: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          address_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          estimated_duration_hint?: string | null
          form_data?: Json | null
          form_schema?: Json | null
          form_version?: string | null
          geohash?: string | null
          h3_index?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          missing_info_warnings?: string[] | null
          photos?: string[] | null
          scope_complexity?: string | null
          service_id: string
          status?: string
          suggested_equipment?: string[] | null
          suggested_materials?: string[] | null
          suggested_questions?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          address_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          estimated_duration_hint?: string | null
          form_data?: Json | null
          form_schema?: Json | null
          form_version?: string | null
          geohash?: string | null
          h3_index?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          missing_info_warnings?: string[] | null
          photos?: string[] | null
          scope_complexity?: string | null
          service_id?: string
          status?: string
          suggested_equipment?: string[] | null
          suggested_materials?: string[] | null
          suggested_questions?: string[] | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "client_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "platform_services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_beacons: {
        Row: {
          android_sdk_version: number | null
          created_at: string
          device_id: string
          device_name: string | null
          fcm_token: string | null
          ios_version: number | null
          is_virtual: boolean
          manufacturer: string | null
          model: string | null
          operating_system: string | null
          os_version: string | null
          platform: string
          profile_id: string
          push_enabled: boolean
          updated_at: string
          web_view_version: string | null
        }
        Insert: {
          android_sdk_version?: number | null
          created_at?: string
          device_id: string
          device_name?: string | null
          fcm_token?: string | null
          ios_version?: number | null
          is_virtual?: boolean
          manufacturer?: string | null
          model?: string | null
          operating_system?: string | null
          os_version?: string | null
          platform: string
          profile_id: string
          push_enabled?: boolean
          updated_at?: string
          web_view_version?: string | null
        }
        Update: {
          android_sdk_version?: number | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          fcm_token?: string | null
          ios_version?: number | null
          is_virtual?: boolean
          manufacturer?: string | null
          model?: string | null
          operating_system?: string | null
          os_version?: string | null
          platform?: string
          profile_id?: string
          push_enabled?: boolean
          updated_at?: string
          web_view_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_device_beacons_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_provider_service_pricing: {
        Args: { p_original_amount: number; p_tax_key?: string }
        Returns: {
          final_amount: number
          original_amount: number
          pricing_signature: string
          tax_amount: number
          tax_rate: number
        }[]
      }
      can_provider_ask_question: {
        Args: { p_provider_id: string; p_service_request_id: string }
        Returns: boolean
      }
      create_provider_proposal: {
        Args: {
          p_final_amount: number
          p_photos: string[]
          p_pricing_signature: string
          p_proposal_description: string
          p_proposal_duration_unit: string
          p_proposal_duration_value: number
          p_proposal_suggested_slots: Json
          p_proposed_amount: number
          p_service_request_id: string
          p_tax_amount: number
          p_tax_rate: number
        }
        Returns: Json
      }
      create_provider_service_request_question: {
        Args: { p_question: string; p_service_request_id: string }
        Returns: Json
      }
      expire_stale_provider_proposals: { Args: never; Returns: number }
      generate_provider_pricing_signature: {
        Args: {
          p_final_amount: number
          p_original_amount: number
          p_tax_amount: number
          p_tax_rate: number
        }
        Returns: string
      }
      generate_unique_provider_slug: {
        Args: { full_name: string; in_provider_id: string }
        Returns: string
      }
      get_client_budget_service_request_detail: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      get_prompt_by_key: { Args: { p_prompt_key: string }; Returns: Json }
      get_provider_proposal_job_detail: {
        Args: {
          p_lat?: number
          p_lng?: number
          p_proposal_id?: string
          p_radius_km?: number
          p_service_request_id?: string
        }
        Returns: Json
      }
      get_public_provider_by_slug: {
        Args: { slug_param: string }
        Returns: Json
      }
      list_client_budget_questions: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_question_status?: string
          p_search?: string
        }
        Returns: Json
      }
      list_client_received_budgets: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      list_provider_own_questions:
        | {
            Args: never
            Returns: {
              city: string
              client_responded_at: string
              client_response: string
              created_at: string
              has_proposal: boolean
              id: string
              masked_client_name: string
              neighborhood: string
              question: string
              service_color_key: string
              service_icon_key: string
              service_request_created_at: string
              service_request_description: string
              service_request_id: string
              service_request_photos: string[]
              service_request_status: string
              service_request_title: string
              service_request_urgency: string
              service_slug: string
              service_title: string
              state_abbr: string
            }[]
          }
        | {
            Args: {
              p_page?: number
              p_page_size?: number
              p_question_status?: string
              p_search?: string
            }
            Returns: Json
          }
      list_provider_sent_budgets:
        | {
            Args: never
            Returns: {
              city: string
              client_rejection_response: string
              created_at: string
              final_amount: number
              id: string
              masked_client_name: string
              neighborhood: string
              photos: string[]
              proposal_description: string
              proposed_amount: number
              service_color_key: string
              service_icon_key: string
              service_request_created_at: string
              service_request_description: string
              service_request_id: string
              service_request_photos: string[]
              service_request_status: string
              service_request_title: string
              service_request_urgency: string
              service_slug: string
              service_title: string
              state_abbr: string
              status: string
              tax_amount: number
              tax_rate: number
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_page?: number
              p_page_size?: number
              p_search?: string
              p_status?: string
            }
            Returns: Json
          }
      list_provider_service_request_questions: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      match_provider_jobs: {
        Args: {
          p_lat: number
          p_lng: number
          p_page?: number
          p_page_size?: number
          p_provider_id: string
          p_radius_km?: number
          p_service_id?: string
          p_sort_mode?: string
        }
        Returns: Json
      }
      reject_client_budget_proposal: {
        Args: { p_proposal_id: string; p_reason: string }
        Returns: Json
      }
      respond_client_budget_question: {
        Args: {
          p_question_id: string
          p_response: string
          p_response_images?: string[]
        }
        Returns: Json
      }
      slugify_for_provider: { Args: { name_input: string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

