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
  message_dispatcher: {
    Tables: {
      message_dispatch_deliveries: {
        Row: {
          attempt_no: number
          created_at: string
          device_id: string
          dispatch_id: string
          fcm_token_snapshot: string | null
          id: string
          outcome: Database["message_dispatcher"]["Enums"]["message_delivery_outcome"]
          updated_at: string
          vendor_error_code: string | null
          vendor_response: Json | null
        }
        Insert: {
          attempt_no?: number
          created_at?: string
          device_id: string
          dispatch_id: string
          fcm_token_snapshot?: string | null
          id?: string
          outcome?: Database["message_dispatcher"]["Enums"]["message_delivery_outcome"]
          updated_at?: string
          vendor_error_code?: string | null
          vendor_response?: Json | null
        }
        Update: {
          attempt_no?: number
          created_at?: string
          device_id?: string
          dispatch_id?: string
          fcm_token_snapshot?: string | null
          id?: string
          outcome?: Database["message_dispatcher"]["Enums"]["message_delivery_outcome"]
          updated_at?: string
          vendor_error_code?: string | null
          vendor_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_dispatch_deliveries_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "message_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      message_dispatcher_audit: {
        Row: {
          changed_by: string
          correlation_id: string | null
          created_at: string
          delta: Json
          dispatch_id: string
          id: number
          new_status: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          old_status:
            | Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
            | null
          profile_id: string
        }
        Insert: {
          changed_by?: string
          correlation_id?: string | null
          created_at?: string
          delta?: Json
          dispatch_id: string
          id?: number
          new_status: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          old_status?:
            | Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
            | null
          profile_id: string
        }
        Update: {
          changed_by?: string
          correlation_id?: string | null
          created_at?: string
          delta?: Json
          dispatch_id?: string
          id?: number
          new_status?: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          old_status?:
            | Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
            | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_dispatcher_audit_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "message_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      message_dispatcher_stats: {
        Row: {
          collected_at: string
          labels: Json
          metric_name: string
          value: number
        }
        Insert: {
          collected_at?: string
          labels?: Json
          metric_name: string
          value: number
        }
        Update: {
          collected_at?: string
          labels?: Json
          metric_name?: string
          value?: number
        }
        Relationships: []
      }
      message_dispatcher_user_limits: {
        Row: {
          email_count_24h: number
          email_window_start: string
          last_push_sent_at: string | null
          profile_id: string
          push_count_24h: number
          push_window_start: string
        }
        Insert: {
          email_count_24h?: number
          email_window_start?: string
          last_push_sent_at?: string | null
          profile_id: string
          push_count_24h?: number
          push_window_start?: string
        }
        Update: {
          email_count_24h?: number
          email_window_start?: string
          last_push_sent_at?: string | null
          profile_id?: string
          push_count_24h?: number
          push_window_start?: string
        }
        Relationships: []
      }
      message_dispatcher_vendor_events: {
        Row: {
          dispatch_id: string | null
          event_type: string
          payload: Json
          processed_at: string
          vendor: string
          vendor_event_id: string
        }
        Insert: {
          dispatch_id?: string | null
          event_type: string
          payload: Json
          processed_at?: string
          vendor: string
          vendor_event_id: string
        }
        Update: {
          dispatch_id?: string | null
          event_type?: string
          payload?: Json
          processed_at?: string
          vendor?: string
          vendor_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_dispatcher_vendor_events_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "message_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      message_dispatches: {
        Row: {
          cancel_reason: string | null
          channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          correlation_id: string
          created_at: string
          failure_code: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          locked_by: string | null
          locked_until: string | null
          max_retries: number
          metadata: Json
          next_retry_at: string | null
          profile_id: string
          retry_count: number
          scheduled_for: string
          source_system: string
          status: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          template_key: string
          template_variables: Json
          updated_at: string
          vendor_message_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          correlation_id?: string
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          locked_by?: string | null
          locked_until?: string | null
          max_retries?: number
          metadata?: Json
          next_retry_at?: string | null
          profile_id: string
          retry_count?: number
          scheduled_for?: string
          source_system?: string
          status?: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          template_key: string
          template_variables?: Json
          updated_at?: string
          vendor_message_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          channel?: Database["message_dispatcher"]["Enums"]["message_channel"]
          correlation_id?: string
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          locked_by?: string | null
          locked_until?: string | null
          max_retries?: number
          metadata?: Json
          next_retry_at?: string | null
          profile_id?: string
          retry_count?: number
          scheduled_for?: string
          source_system?: string
          status?: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          template_key?: string
          template_variables?: Json
          updated_at?: string
          vendor_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_dispatches_template_key_channel_fkey"
            columns: ["template_key", "channel"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["template_key", "channel"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body_template: string
          channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          created_at: string
          subject_template: string | null
          template_key: string
          variable_schema: Json
        }
        Insert: {
          active?: boolean
          body_template: string
          channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          created_at?: string
          subject_template?: string | null
          template_key: string
          variable_schema?: Json
        }
        Update: {
          active?: boolean
          body_template?: string
          channel?: Database["message_dispatcher"]["Enums"]["message_channel"]
          created_at?: string
          subject_template?: string | null
          template_key?: string
          variable_schema?: Json
        }
        Relationships: []
      }
    }
    Views: {
      alert_janitor_churn_v: {
        Row: {
          lease_reclaims_1m: number | null
        }
        Relationships: []
      }
      alert_queue_lag_v: {
        Row: {
          lag_count: number | null
        }
        Relationships: []
      }
      alert_retryable_by_source_v: {
        Row: {
          retryable_count: number | null
          source_system: string | null
        }
        Relationships: []
      }
      alert_retryable_depth_v: {
        Row: {
          retryable_count: number | null
        }
        Relationships: []
      }
      alert_terminal_spike_v: {
        Row: {
          ingested_15m: number | null
          terminal_15m: number | null
          terminal_rate: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      message_dispatch_status_allowed: {
        Args: {
          p_from: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          p_to: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
        }
        Returns: boolean
      }
      message_dispatcher_activate_scheduled: { Args: never; Returns: number }
      message_dispatcher_audit_partitioning_growth_stub_sql: {
        Args: never
        Returns: string
      }
      message_dispatcher_audit_timeline: {
        Args: { p_dispatch_id: string }
        Returns: Json
      }
      message_dispatcher_build_checkout_dto: {
        Args: {
          p_channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          p_correlation_id: string
          p_deliveries: Json
          p_id: string
          p_locked_by: string
          p_locked_until: string
          p_profile_id: string
          p_recipient_email: string
          p_status: Database["message_dispatcher"]["Enums"]["message_dispatch_status"]
          p_template_key: string
          p_template_variables: Json
        }
        Returns: Json
      }
      message_dispatcher_cancel: {
        Args: { p_dispatch_id: string; p_reason?: string }
        Returns: Json
      }
      message_dispatcher_checkout_batch: {
        Args: { p_limit?: number; p_worker_id?: string }
        Returns: Json
      }
      message_dispatcher_compute_next_retry_at: {
        Args: { p_retry_count: number }
        Returns: string
      }
      message_dispatcher_disable_device_beacon: {
        Args: { p_device_id: string; p_profile_id: string }
        Returns: undefined
      }
      message_dispatcher_evaluate_alerts: { Args: never; Returns: Json }
      message_dispatcher_evaluate_pending: { Args: never; Returns: number }
      message_dispatcher_ingest: {
        Args: {
          p_channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          p_idempotency_key: string
          p_metadata?: Json
          p_profile_id: string
          p_scheduled_for?: string
          p_source_system?: string
          p_template_key: string
          p_template_variables?: Json
        }
        Returns: Json
      }
      message_dispatcher_invoke_worker: { Args: never; Returns: undefined }
      message_dispatcher_is_resend_delivered_event: {
        Args: { p_event_type: string }
        Returns: boolean
      }
      message_dispatcher_is_resend_hard_bounce_event: {
        Args: { p_event_type: string }
        Returns: boolean
      }
      message_dispatcher_promote_retries: { Args: never; Returns: number }
      message_dispatcher_reclaim_leases: { Args: never; Returns: number }
      message_dispatcher_reconcile_vendor_event: {
        Args: {
          p_event_type: string
          p_payload?: Json
          p_vendor: string
          p_vendor_event_id: string
          p_vendor_message_id: string
        }
        Returns: Json
      }
      message_dispatcher_refresh_stats: { Args: never; Returns: undefined }
      message_dispatcher_report_delivery_outcome: {
        Args: {
          p_channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          p_deliveries?: Json
          p_dispatch_id: string
          p_error_body?: string
          p_error_code?: string
          p_http_status?: number
          p_retryable?: boolean
          p_success: boolean
          p_vendor_message_id?: string
          p_worker_id: string
        }
        Returns: Json
      }
      message_dispatcher_should_disable_beacon: {
        Args: { p_error_code: string }
        Returns: boolean
      }
      message_dispatcher_try_claim_worker_invoke: {
        Args: never
        Returns: boolean
      }
      message_dispatcher_worker_invoke_min_interval_seconds: {
        Args: never
        Returns: number
      }
    }
    Enums: {
      message_channel: "email" | "push"
      message_delivery_outcome:
        | "pending"
        | "sent"
        | "failed_retryable"
        | "failed_terminal"
      message_dispatch_status:
        | "PENDING_EVALUATION"
        | "SCHEDULED"
        | "CANCELED"
        | "QUEUED"
        | "PROCESSING"
        | "DELIVERED"
        | "FAILED_RETRYABLE"
        | "FAILED_TERMINAL"
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
      list_provider_own_questions: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_question_status?: string
          p_search?: string
        }
        Returns: Json
      }
      list_provider_sent_budgets: {
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
      purge_stale_user_device_beacons: { Args: never; Returns: number }
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
  message_dispatcher: {
    Enums: {
      message_channel: ["email", "push"],
      message_delivery_outcome: [
        "pending",
        "sent",
        "failed_retryable",
        "failed_terminal",
      ],
      message_dispatch_status: [
        "PENDING_EVALUATION",
        "SCHEDULED",
        "CANCELED",
        "QUEUED",
        "PROCESSING",
        "DELIVERED",
        "FAILED_RETRYABLE",
        "FAILED_TERMINAL",
      ],
    },
  },
  public: {
    Enums: {},
  },
} as const

