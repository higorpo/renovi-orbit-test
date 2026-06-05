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
      message_dispatch_engagements: {
        Row: {
          channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          created_at: string
          dispatch_id: string
          engagement_type: Database["message_dispatcher"]["Enums"]["message_engagement_type"]
          first_seen_at: string
          id: string
          last_seen_at: string
          metadata: Json
          profile_id: string
          seen_count: number
          source: string
        }
        Insert: {
          channel: Database["message_dispatcher"]["Enums"]["message_channel"]
          created_at?: string
          dispatch_id: string
          engagement_type: Database["message_dispatcher"]["Enums"]["message_engagement_type"]
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          profile_id: string
          seen_count?: number
          source: string
        }
        Update: {
          channel?: Database["message_dispatcher"]["Enums"]["message_channel"]
          created_at?: string
          dispatch_id?: string
          engagement_type?: Database["message_dispatcher"]["Enums"]["message_engagement_type"]
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          profile_id?: string
          seen_count?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_dispatch_engagements_dispatch_id_fkey"
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
          bypass_limits: boolean
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
          bypass_limits?: boolean
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
          bypass_limits?: boolean
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
          p_bypass_limits?: boolean
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
      message_dispatcher_invoke_worker: { Args: never; Returns: number }
      message_dispatcher_is_quiet_hours: {
        Args: { p_ts?: string }
        Returns: boolean
      }
      message_dispatcher_is_resend_delivered_event: {
        Args: { p_event_type: string }
        Returns: boolean
      }
      message_dispatcher_is_resend_hard_bounce_event: {
        Args: { p_event_type: string }
        Returns: boolean
      }
      message_dispatcher_is_resend_opened_event: {
        Args: { p_event_type: string }
        Returns: boolean
      }
      message_dispatcher_next_send_window: {
        Args: { p_ts?: string }
        Returns: string
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
      message_dispatcher_record_engagement: {
        Args: {
          p_dispatch_id: string
          p_engagement_type: Database["message_dispatcher"]["Enums"]["message_engagement_type"]
          p_metadata?: Json
          p_source: string
        }
        Returns: Json
      }
      message_dispatcher_record_push_click: {
        Args: { p_dispatch_id: string; p_metadata?: Json }
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
      message_engagement_type: "opened" | "clicked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      chat_audit: {
        Row: {
          actor_id: string | null
          chat_id: string
          created_at: string
          from_status:
            | Database["public"]["Enums"]["cns_conversation_status"]
            | null
          id: number
          metadata: Json
          to_status: Database["public"]["Enums"]["cns_conversation_status"]
        }
        Insert: {
          actor_id?: string | null
          chat_id: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["cns_conversation_status"]
            | null
          id?: number
          metadata?: Json
          to_status: Database["public"]["Enums"]["cns_conversation_status"]
        }
        Update: {
          actor_id?: string | null
          chat_id?: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["cns_conversation_status"]
            | null
          id?: number
          metadata?: Json
          to_status?: Database["public"]["Enums"]["cns_conversation_status"]
        }
        Relationships: []
      }
      chat_media_upload_sessions: {
        Row: {
          chat_id: string
          created_at: string
          expires_at: string
          id: string
          status: string
          uploader_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          uploader_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_media_upload_sessions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_media_upload_sessions_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          chat_id: string
          created_at: string
          delivery_status: Database["public"]["Enums"]["cns_delivery_status"]
          id: string
          idempotency_key: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          message_type: Database["public"]["Enums"]["cns_message_type"]
          payload: Json
          sender_user_id: string | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["cns_delivery_status"]
          id?: string
          idempotency_key: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          message_type: Database["public"]["Enums"]["cns_message_type"]
          payload?: Json
          sender_user_id?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["cns_delivery_status"]
          id?: string
          idempotency_key?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          message_type?: Database["public"]["Enums"]["cns_message_type"]
          payload?: Json
          sender_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rate_limit_buckets: {
        Row: {
          chat_id: string
          message_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          chat_id: string
          message_count?: number
          user_id: string
          window_started_at: string
        }
        Update: {
          chat_id?: string
          message_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rate_limit_buckets_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rate_limit_buckets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_receipts: {
        Row: {
          chat_id: string
          last_read_at: string
          last_read_message_id: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_receipts_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_receipts_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          activated_at: string
          client_id: string
          closed_at: string | null
          closed_by_user_id: string | null
          closure_reason: string | null
          closure_type: Database["public"]["Enums"]["cns_closure_type"] | null
          created_at: string
          id: string
          inactivated_at: string | null
          inactivation_reason:
            | Database["public"]["Enums"]["cns_inactivation_reason"]
            | null
          last_interaction_at: string
          provider_id: string
          service_request_id: string
          status: Database["public"]["Enums"]["cns_conversation_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string
          client_id: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          closure_reason?: string | null
          closure_type?: Database["public"]["Enums"]["cns_closure_type"] | null
          created_at?: string
          id?: string
          inactivated_at?: string | null
          inactivation_reason?:
            | Database["public"]["Enums"]["cns_inactivation_reason"]
            | null
          last_interaction_at?: string
          provider_id: string
          service_request_id: string
          status?: Database["public"]["Enums"]["cns_conversation_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string
          client_id?: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          closure_reason?: string | null
          closure_type?: Database["public"]["Enums"]["cns_closure_type"] | null
          created_at?: string
          id?: string
          inactivated_at?: string | null
          inactivation_reason?:
            | Database["public"]["Enums"]["cns_inactivation_reason"]
            | null
          last_interaction_at?: string
          provider_id?: string
          service_request_id?: string
          status?: Database["public"]["Enums"]["cns_conversation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_closed_by_user_id_fkey"
            columns: ["closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
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
      contracted_services: {
        Row: {
          accepted_proposal_id: string
          agreed_slot: Json
          client_id: string
          created_at: string
          duration_unit: string
          duration_value: number
          id: string
          provider_id: string
          scheduled_end_date: string | null
          scheduled_shift: string
          scheduled_start_date: string
          service_request_id: string
          status: Database["public"]["Enums"]["contracted_service_status"]
          updated_at: string
        }
        Insert: {
          accepted_proposal_id: string
          agreed_slot: Json
          client_id: string
          created_at?: string
          duration_unit: string
          duration_value: number
          id?: string
          provider_id: string
          scheduled_end_date?: string | null
          scheduled_shift: string
          scheduled_start_date: string
          service_request_id: string
          status?: Database["public"]["Enums"]["contracted_service_status"]
          updated_at?: string
        }
        Update: {
          accepted_proposal_id?: string
          agreed_slot?: Json
          client_id?: string
          created_at?: string
          duration_unit?: string
          duration_value?: number
          id?: string
          provider_id?: string
          scheduled_end_date?: string | null
          scheduled_shift?: string
          scheduled_start_date?: string
          service_request_id?: string
          status?: Database["public"]["Enums"]["contracted_service_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracted_services_accepted_proposal_id_fkey"
            columns: ["accepted_proposal_id"]
            isOneToOne: true
            referencedRelation: "provider_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracted_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracted_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracted_services_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          chat_id: string | null
          created_at: string
          dead_letter: boolean
          dead_letter_at: string | null
          event_type: string
          id: string
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          payload: Json
          processed_at: string | null
          retry_count: number
          service_request_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          chat_id?: string | null
          created_at?: string
          dead_letter?: boolean
          dead_letter_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          service_request_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          chat_id?: string | null
          created_at?: string
          dead_letter?: boolean
          dead_letter_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          service_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_events_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          duration_ms: number | null
          error_count: number
          finished_at: string | null
          id: number
          job_name: string
          metadata: Json
          processed_count: number
          started_at: string
          transitioned_count: number
        }
        Insert: {
          duration_ms?: number | null
          error_count?: number
          finished_at?: string | null
          id?: number
          job_name: string
          metadata?: Json
          processed_count?: number
          started_at?: string
          transitioned_count?: number
        }
        Update: {
          duration_ms?: number | null
          error_count?: number
          finished_at?: string | null
          id?: number
          job_name?: string
          metadata?: Json
          processed_count?: number
          started_at?: string
          transitioned_count?: number
        }
        Relationships: []
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
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
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
      proposal_audit: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["proposal_status"] | null
          id: number
          metadata: Json
          proposal_id: string
          to_status: Database["public"]["Enums"]["proposal_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["proposal_status"] | null
          id?: number
          metadata?: Json
          proposal_id: string
          to_status: Database["public"]["Enums"]["proposal_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["proposal_status"] | null
          id?: number
          metadata?: Json
          proposal_id?: string
          to_status?: Database["public"]["Enums"]["proposal_status"]
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
          created_at: string
          expired_at: string | null
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
          revision_count: number
          revision_notes: string | null
          revision_reason:
            | Database["public"]["Enums"]["proposal_revision_reason"]
            | null
          selected_slot: Json | null
          service_request_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          submitted_at: string | null
          tax_amount: number
          tax_rate: number
          updated_at: string
          version: number
        }
        Insert: {
          client_rejection_response?: string | null
          created_at?: string
          expired_at?: string | null
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
          revision_count?: number
          revision_notes?: string | null
          revision_reason?:
            | Database["public"]["Enums"]["proposal_revision_reason"]
            | null
          selected_slot?: Json | null
          service_request_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          tax_amount: number
          tax_rate: number
          updated_at?: string
          version?: number
        }
        Update: {
          client_rejection_response?: string | null
          created_at?: string
          expired_at?: string | null
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
          revision_count?: number
          revision_notes?: string | null
          revision_reason?:
            | Database["public"]["Enums"]["proposal_revision_reason"]
            | null
          selected_slot?: Json | null
          service_request_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          tax_amount?: number
          tax_rate?: number
          updated_at?: string
          version?: number
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
      rpc_idempotency_records: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          idempotency_key: string
          operation: string
          request_hash: string | null
          response_body: Json
          response_status: number
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          operation: string
          request_hash?: string | null
          response_body: Json
          response_status: number
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          request_hash?: string | null
          response_body?: Json
          response_status?: number
        }
        Relationships: [
          {
            foreignKeyName: "rpc_idempotency_records_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_negotiation_stats: {
        Row: {
          active_chat_count: number
          service_request_id: string
          updated_at: string
          version: number
        }
        Insert: {
          active_chat_count?: number
          service_request_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active_chat_count?: number
          service_request_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_request_negotiation_stats_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          address_id: string | null
          cancelled_at: string | null
          client_id: string
          completed_at: string | null
          contracted_service_id: string | null
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
          status: Database["public"]["Enums"]["service_request_status"]
          suggested_equipment: string[] | null
          suggested_materials: string[] | null
          tags: string[] | null
          title: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          address_id?: string | null
          cancelled_at?: string | null
          client_id: string
          completed_at?: string | null
          contracted_service_id?: string | null
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
          status?: Database["public"]["Enums"]["service_request_status"]
          suggested_equipment?: string[] | null
          suggested_materials?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          address_id?: string | null
          cancelled_at?: string | null
          client_id?: string
          completed_at?: string | null
          contracted_service_id?: string | null
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
          status?: Database["public"]["Enums"]["service_request_status"]
          suggested_equipment?: string[] | null
          suggested_materials?: string[] | null
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
            foreignKeyName: "service_requests_contracted_service_id_fkey"
            columns: ["contracted_service_id"]
            isOneToOne: false
            referencedRelation: "contracted_services"
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
      _legacy_bridge_idempotency_uuid: {
        Args: { p_seed: string }
        Returns: string
      }
      accept_proposal: {
        Args: {
          p_idempotency_key: string
          p_proposal_id: string
          p_selected_slot: Json
        }
        Returns: Json
      }
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
      cancel_service_request: {
        Args: { p_idempotency_key: string; p_service_request_id: string }
        Returns: Json
      }
      cns_assert_chat_media_path_shape: {
        Args: { p_path: string }
        Returns: undefined
      }
      cns_assert_chat_media_storage_path: {
        Args: { p_chat_id: string; p_path: string; p_upload_session_id: string }
        Returns: undefined
      }
      cns_assert_list_response_size: { Args: { p_body: Json }; Returns: Json }
      cns_attach_message_media: {
        Args: {
          p_chat_id: string
          p_paths: string[]
          p_upload_session_id: string
        }
        Returns: undefined
      }
      cns_chat_free_messaging_allowed: {
        Args: { p_chat_id: string }
        Returns: boolean
      }
      cns_check_message_rate_limit: {
        Args: { p_chat_id: string }
        Returns: undefined
      }
      cns_close_conversation: {
        Args: {
          p_chat_id: string
          p_closure_reason?: string
          p_confirm: boolean
          p_idempotency_key: string
        }
        Returns: Json
      }
      cns_create_media_upload_session: {
        Args: { p_chat_id: string }
        Returns: Json
      }
      cns_emit_analytics: { Args: { p_event_id: string }; Returns: Json }
      cns_enqueue_notifications: { Args: { p_event_id: string }; Returns: Json }
      cns_evaluate_reciprocity_batch: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      cns_has_bilateral_reciprocity: {
        Args: { p_chat_id: string; p_window_hours?: number }
        Returns: boolean
      }
      cns_initiate_conversation: {
        Args: { p_idempotency_key: string; p_service_request_id: string }
        Returns: Json
      }
      cns_janitor_orphan_media: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      cns_list_response_max_bytes: { Args: never; Returns: number }
      cns_mark_conversation_read: {
        Args: { p_chat_id: string; p_last_read_message_id?: string }
        Returns: Json
      }
      cns_message_preview_text: {
        Args: {
          p_message_type: Database["public"]["Enums"]["cns_message_type"]
          p_payload: Json
        }
        Returns: string
      }
      cns_mmd_ingest: {
        Args: {
          p_event_type: string
          p_idempotency_key: string
          p_metadata?: Json
          p_recipient_profile_id: string
          p_template_variables: Json
        }
        Returns: Json
      }
      cns_process_domain_events: {
        Args: {
          p_batch_size?: number
          p_record_job_run?: boolean
          p_worker_id?: string
        }
        Returns: Json
      }
      cns_project_message_payload_for_list: {
        Args: {
          p_message_type: Database["public"]["Enums"]["cns_message_type"]
          p_payload: Json
        }
        Returns: Json
      }
      cns_reconcile_pending_deliveries: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      cns_refresh_media_signed_urls: {
        Args: {
          p_expires_in?: number
          p_message_ids?: string[]
          p_paths?: string[]
        }
        Returns: Json
      }
      cns_send_message: {
        Args: {
          p_chat_id?: string
          p_idempotency_key: string
          p_message_type: Database["public"]["Enums"]["cns_message_type"]
          p_payload?: Json
          p_service_request_id?: string
        }
        Returns: Json
      }
      cns_service_request_allows_chat_messaging: {
        Args: { p_chat_id: string; p_service_request_id: string }
        Returns: boolean
      }
      cns_set_local_statement_timeout: {
        Args: { p_interval: string }
        Returns: undefined
      }
      cns_validate_upload_session: {
        Args: { p_chat_id?: string; p_upload_session_id: string }
        Returns: Json
      }
      count_inclusive_working_days: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: number
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
      cron_chat_evaluate_reciprocity: { Args: never; Returns: Json }
      cron_cns_janitor_orphan_media: { Args: never; Returns: Json }
      cron_cns_process_domain_events: { Args: never; Returns: Json }
      cron_cns_reconcile_pending_deliveries: { Args: never; Returns: Json }
      cron_proposal_expire_pending: { Args: never; Returns: Json }
      decline_revision_request: {
        Args: { p_idempotency_key: string; p_proposal_id: string }
        Returns: Json
      }
      derive_service_list_phase: {
        Args: {
          p_cs_provider_id: string
          p_cs_status: Database["public"]["Enums"]["contracted_service_status"]
          p_sr_status: Database["public"]["Enums"]["service_request_status"]
          p_viewer_id: string
          p_viewer_role: string
        }
        Returns: string
      }
      domain_events_release_stale_leases: { Args: never; Returns: number }
      enqueue_proposal_expiring_soon_reminders: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      expire_pending_proposals: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
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
      get_conversation_detail: { Args: { p_chat_id: string }; Returns: Json }
      get_negotiation_audit_timeline: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      get_prompt_by_key: { Args: { p_prompt_key: string }; Returns: Json }
      get_proposal_detail_for_provider: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
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
      get_service: { Args: { p_service_request_id: string }; Returns: Json }
      idempotency_begin: {
        Args: {
          p_idempotency_key: string
          p_operation: string
          p_request_hash?: string
        }
        Returns: Json
      }
      idempotency_commit: {
        Args: {
          p_idempotency_key: string
          p_operation: string
          p_request_hash: string
          p_response_body: Json
          p_response_status: number
        }
        Returns: undefined
      }
      is_chat_participant: { Args: { p_chat_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_provider: { Args: never; Returns: boolean }
      job_run_abort_latest: {
        Args: { p_fatal_error: string; p_job_name: string }
        Returns: undefined
      }
      job_run_begin: {
        Args: { p_job_name: string; p_job_version?: string }
        Returns: number
      }
      job_run_finish: {
        Args: {
          p_error_count?: number
          p_fatal_error?: string
          p_job_run_id: number
          p_metadata?: Json
          p_processed_count?: number
          p_started_at: string
          p_transitioned_count?: number
        }
        Returns: undefined
      }
      list_chat_messages: {
        Args: {
          p_after?: boolean
          p_chat_id: string
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_limit?: number
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
      list_conversations: {
        Args: {
          p_cursor_id?: string
          p_cursor_last_interaction_at?: string
          p_page_size?: number
        }
        Returns: Json
      }
      list_proposal_versions: { Args: { p_chat_id: string }; Returns: Json }
      list_provider_proposal_history: {
        Args: { p_service_request_id: string }
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
      list_services: {
        Args: {
          p_category_title?: string
          p_city_name?: string
          p_date_from?: string
          p_date_to?: string
          p_has_images?: boolean
          p_has_proposals?: boolean
          p_list_phase?: string
          p_neighborhood?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
        }
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
      mmd_idempotency_uuid: { Args: { p_key: string }; Returns: string }
      platform_constant_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      platform_constant_int: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      project_service_row: {
        Args: { p_service_request_id: string; p_viewer_id: string }
        Returns: Json
      }
      purge_stale_user_device_beacons: { Args: never; Returns: number }
      record_domain_event: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_chat_id?: string
          p_event_type: string
          p_payload?: Json
          p_service_request_id?: string
        }
        Returns: string
      }
      reject_client_budget_proposal: {
        Args: { p_proposal_id: string; p_reason: string }
        Returns: Json
      }
      reject_proposal: {
        Args: {
          p_idempotency_key: string
          p_proposal_id: string
          p_rejection_reason: string
        }
        Returns: Json
      }
      replay_domain_event: { Args: { p_event_id: string }; Returns: Json }
      request_proposal_revision: {
        Args: {
          p_idempotency_key: string
          p_proposal_id: string
          p_revision_notes?: string
          p_revision_reason: Database["public"]["Enums"]["proposal_revision_reason"]
        }
        Returns: Json
      }
      resolve_proposal_chat_id: {
        Args: { p_provider_id: string; p_service_request_id: string }
        Returns: string
      }
      sanitize_job_error: { Args: { p_message: string }; Returns: string }
      service_viewer_has_access: {
        Args: { p_service_request_id: string; p_viewer_id: string }
        Returns: boolean
      }
      slugify_for_provider: { Args: { name_input: string }; Returns: string }
      view_services_mask_client_name: {
        Args: { p_full_name: string }
        Returns: string
      }
    }
    Enums: {
      cns_closure_type:
        | "MANUAL"
        | "PROPOSAL_ACCEPTED_ELSEWHERE"
        | "SERVICE_REQUEST_CANCELLED"
      cns_conversation_status: "ACTIVE" | "INACTIVE" | "CLOSED"
      cns_delivery_status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED"
      cns_inactivation_reason: "NO_RECIPROCITY"
      cns_message_type:
        | "TEXT"
        | "IMAGE"
        | "SYSTEM"
        | "PROPOSAL"
        | "WORKFLOW_ACTION"
        | "AUDIO"
      contracted_service_status: "PENDING_PAYMENT" | "COMPLETED" | "CANCELLED"
      proposal_revision_reason:
        | "PRICE_TOO_HIGH"
        | "REDUCE_SCOPE"
        | "DATE_NOT_AVAILABLE"
        | "CHANGE_TIMELINE"
        | "CLARIFY_DETAILS"
        | "OTHER"
      proposal_status:
        | "PENDING"
        | "ACCEPTED"
        | "REJECTED"
        | "EXPIRED"
        | "REVISION_REQUESTED"
        | "REVISED"
        | "REJECTED_AUTOMATICALLY"
      service_request_status: "OPEN" | "COMPLETED" | "CANCELLED"
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
      message_engagement_type: ["opened", "clicked"],
    },
  },
  public: {
    Enums: {
      cns_closure_type: [
        "MANUAL",
        "PROPOSAL_ACCEPTED_ELSEWHERE",
        "SERVICE_REQUEST_CANCELLED",
      ],
      cns_conversation_status: ["ACTIVE", "INACTIVE", "CLOSED"],
      cns_delivery_status: ["PENDING", "SENT", "DELIVERED", "READ", "FAILED"],
      cns_inactivation_reason: ["NO_RECIPROCITY"],
      cns_message_type: [
        "TEXT",
        "IMAGE",
        "SYSTEM",
        "PROPOSAL",
        "WORKFLOW_ACTION",
        "AUDIO",
      ],
      contracted_service_status: ["PENDING_PAYMENT", "COMPLETED", "CANCELLED"],
      proposal_revision_reason: [
        "PRICE_TOO_HIGH",
        "REDUCE_SCOPE",
        "DATE_NOT_AVAILABLE",
        "CHANGE_TIMELINE",
        "CLARIFY_DETAILS",
        "OTHER",
      ],
      proposal_status: [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "EXPIRED",
        "REVISION_REQUESTED",
        "REVISED",
        "REJECTED_AUTOMATICALLY",
      ],
      service_request_status: ["OPEN", "COMPLETED", "CANCELLED"],
    },
  },
} as const

