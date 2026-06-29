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
      message_dispatcher_compute_push_scheduled_slot: {
        Args: {
          p_cooldown_minutes: number
          p_exclude_dispatch_id?: string
          p_last_push_sent_at: string
          p_profile_id: string
          p_sibling_offset?: number
        }
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
      client_card_tokens: {
        Row: {
          billing_address: Json
          card_brand: string
          card_number_masked: string
          cardholder_name: string
          client_id: string
          created_at: string
          expiry_month: number
          expiry_year: number
          gateway_card_token: string
          gateway_payment_profile_id: string
          gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          id: string
          state: Database["public"]["Enums"]["payment_client_card_token_state"]
          updated_at: string
        }
        Insert: {
          billing_address: Json
          card_brand: string
          card_number_masked: string
          cardholder_name: string
          client_id: string
          created_at?: string
          expiry_month: number
          expiry_year: number
          gateway_card_token: string
          gateway_payment_profile_id: string
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          state?: Database["public"]["Enums"]["payment_client_card_token_state"]
          updated_at?: string
        }
        Update: {
          billing_address?: Json
          card_brand?: string
          card_number_masked?: string
          cardholder_name?: string
          client_id?: string
          created_at?: string
          expiry_month?: number
          expiry_year?: number
          gateway_card_token?: string
          gateway_payment_profile_id?: string
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          state?: Database["public"]["Enums"]["payment_client_card_token_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_card_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          cancellation_reason: string | null
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          duration_unit: string
          duration_value: number
          executed_at: string | null
          id: string
          provider_id: string
          scheduled_end_date: string | null
          scheduled_shift: string
          scheduled_start_date: string
          service_execution_at: string | null
          service_request_id: string
          status: Database["public"]["Enums"]["contracted_service_status"]
          updated_at: string
        }
        Insert: {
          accepted_proposal_id: string
          agreed_slot: Json
          cancellation_reason?: string | null
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          duration_unit: string
          duration_value: number
          executed_at?: string | null
          id?: string
          provider_id: string
          scheduled_end_date?: string | null
          scheduled_shift: string
          scheduled_start_date: string
          service_execution_at?: string | null
          service_request_id: string
          status?: Database["public"]["Enums"]["contracted_service_status"]
          updated_at?: string
        }
        Update: {
          accepted_proposal_id?: string
          agreed_slot?: Json
          cancellation_reason?: string | null
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          duration_unit?: string
          duration_value?: number
          executed_at?: string | null
          id?: string
          provider_id?: string
          scheduled_end_date?: string | null
          scheduled_shift?: string
          scheduled_start_date?: string
          service_execution_at?: string | null
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
      payment_attempts: {
        Row: {
          attempt_number: number
          charge_amount: number | null
          completed_at: string | null
          created_at: string
          failure_code: string | null
          failure_reason: string | null
          gateway_latency_ms: number | null
          id: string
          initiated_at: string
          initiator: Database["public"]["Enums"]["payment_attempt_initiator"]
          outcome: Database["public"]["Enums"]["payment_attempt_outcome"] | null
          provider_response_summary: Json | null
          schedule_id: string
        }
        Insert: {
          attempt_number: number
          charge_amount?: number | null
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway_latency_ms?: number | null
          id?: string
          initiated_at?: string
          initiator: Database["public"]["Enums"]["payment_attempt_initiator"]
          outcome?:
            | Database["public"]["Enums"]["payment_attempt_outcome"]
            | null
          provider_response_summary?: Json | null
          schedule_id: string
        }
        Update: {
          attempt_number?: number
          charge_amount?: number | null
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway_latency_ms?: number | null
          id?: string
          initiated_at?: string
          initiator?: Database["public"]["Enums"]["payment_attempt_initiator"]
          outcome?:
            | Database["public"]["Enums"]["payment_attempt_outcome"]
            | null
          provider_response_summary?: Json | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "client_payment_transactions_v"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "payment_attempts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "provider_payment_receivables_v"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      payment_audit_log: {
        Row: {
          actor: Database["public"]["Enums"]["payment_audit_actor"]
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          from_state: string | null
          id: string
          metadata: Json
          schedule_id: string | null
          service_id: string | null
          to_state: string | null
        }
        Insert: {
          actor: Database["public"]["Enums"]["payment_audit_actor"]
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          from_state?: string | null
          id?: string
          metadata?: Json
          schedule_id?: string | null
          service_id?: string | null
          to_state?: string | null
        }
        Update: {
          actor?: Database["public"]["Enums"]["payment_audit_actor"]
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          from_state?: string | null
          id?: string
          metadata?: Json
          schedule_id?: string | null
          service_id?: string | null
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "client_payment_transactions_v"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "payment_audit_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "provider_payment_receivables_v"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "payment_audit_log_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "contracted_services"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          service_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          service_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "contracted_services"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_tokens: {
        Row: {
          created_at: string
          expires_at: string
          gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          is_sandbox: boolean
          refreshed_at: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          is_sandbox?: boolean
          refreshed_at?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          is_sandbox?: boolean
          refreshed_at?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_schedules: {
        Row: {
          automatic_attempt_count: number
          base_amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          charge_scheduled_at: string
          clearsale_session_id: string | null
          client_card_token_id: string | null
          client_id: string
          client_ip_address: string | null
          commission_rate_pct: number
          contracted_service_id: string
          created_at: string
          failed_at: string | null
          failed_permanently_at: string | null
          failure_code: string | null
          failure_reason: string | null
          gateway_charge_id: string | null
          gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          gateway_transaction_id: string | null
          id: string
          idempotency_key: string
          installment_number: number
          is_disputed: boolean
          locked_until: string | null
          manual_attempt_count: number
          max_attempts: number
          needs_payment_method_update: boolean
          next_retry_at: string | null
          paid_amount: number | null
          paid_at: string | null
          provider_id: string
          provider_payout: number
          reconciliation_failure_count: number
          refunded_amount: number | null
          refunded_at: string | null
          state: Database["public"]["Enums"]["payment_schedule_state"]
          upcoming_charge_notified_at: string | null
          updated_at: string
        }
        Insert: {
          automatic_attempt_count?: number
          base_amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charge_scheduled_at: string
          clearsale_session_id?: string | null
          client_card_token_id?: string | null
          client_id: string
          client_ip_address?: string | null
          commission_rate_pct: number
          contracted_service_id: string
          created_at?: string
          failed_at?: string | null
          failed_permanently_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          gateway_charge_id?: string | null
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key: string
          installment_number: number
          is_disputed?: boolean
          locked_until?: string | null
          manual_attempt_count?: number
          max_attempts?: number
          needs_payment_method_update?: boolean
          next_retry_at?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          provider_id: string
          provider_payout: number
          reconciliation_failure_count?: number
          refunded_amount?: number | null
          refunded_at?: string | null
          state?: Database["public"]["Enums"]["payment_schedule_state"]
          upcoming_charge_notified_at?: string | null
          updated_at?: string
        }
        Update: {
          automatic_attempt_count?: number
          base_amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charge_scheduled_at?: string
          clearsale_session_id?: string | null
          client_card_token_id?: string | null
          client_id?: string
          client_ip_address?: string | null
          commission_rate_pct?: number
          contracted_service_id?: string
          created_at?: string
          failed_at?: string | null
          failed_permanently_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          gateway_charge_id?: string | null
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string
          installment_number?: number
          is_disputed?: boolean
          locked_until?: string | null
          manual_attempt_count?: number
          max_attempts?: number
          needs_payment_method_update?: boolean
          next_retry_at?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          provider_id?: string
          provider_payout?: number
          reconciliation_failure_count?: number
          refunded_amount?: number | null
          refunded_at?: string | null
          state?: Database["public"]["Enums"]["payment_schedule_state"]
          upcoming_charge_notified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_client_card_token_id_fkey"
            columns: ["client_card_token_id"]
            isOneToOne: false
            referencedRelation: "client_card_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_client_card_token_id_fkey"
            columns: ["client_card_token_id"]
            isOneToOne: false
            referencedRelation: "client_card_tokens_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_contracted_service_id_fkey"
            columns: ["contracted_service_id"]
            isOneToOne: true
            referencedRelation: "contracted_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          failure_reason: string | null
          gateway_event_id: string
          gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          id: string
          is_duplicate: boolean
          next_retry_at: string | null
          processed_at: string | null
          raw_headers: Json
          raw_payload: Json
          retry_count: number
          state: Database["public"]["Enums"]["payment_webhook_event_state"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          failure_reason?: string | null
          gateway_event_id: string
          gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          is_duplicate?: boolean
          next_retry_at?: string | null
          processed_at?: string | null
          raw_headers: Json
          raw_payload: Json
          retry_count?: number
          state?: Database["public"]["Enums"]["payment_webhook_event_state"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          failure_reason?: string | null
          gateway_event_id?: string
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          is_duplicate?: boolean
          next_retry_at?: string | null
          processed_at?: string | null
          raw_headers?: Json
          raw_payload?: Json
          retry_count?: number
          state?: Database["public"]["Enums"]["payment_webhook_event_state"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_processing_queue: {
        Row: {
          attempt_count: number
          attempted_at: string | null
          created_at: string
          event_type: string
          failure_reason: string | null
          gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          id: string
          scheduled_at: string
          state: Database["public"]["Enums"]["payment_webhook_queue_state"]
          webhook_event_id: string
        }
        Insert: {
          attempt_count?: number
          attempted_at?: string | null
          created_at?: string
          event_type: string
          failure_reason?: string | null
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          scheduled_at?: string
          state?: Database["public"]["Enums"]["payment_webhook_queue_state"]
          webhook_event_id: string
        }
        Update: {
          attempt_count?: number
          attempted_at?: string | null
          created_at?: string
          event_type?: string
          failure_reason?: string | null
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          scheduled_at?: string
          state?: Database["public"]["Enums"]["payment_webhook_queue_state"]
          webhook_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_processing_queue_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: true
            referencedRelation: "payment_webhook_events"
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
          operational_status: Database["public"]["Enums"]["provider_operational_status"]
          phone: string | null
          profile_image_path: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          operational_status?: Database["public"]["Enums"]["provider_operational_status"]
          phone?: string | null
          profile_image_path?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          operational_status?: Database["public"]["Enums"]["provider_operational_status"]
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
      provider_gateway_accounts: {
        Row: {
          created_at: string
          document: string
          email_dispatched_at: string | null
          gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          id: string
          netcred_bank_account_id: string | null
          netcred_company_id: string | null
          onboarding_activated_at: string | null
          onboarding_status: Database["public"]["Enums"]["payment_provider_onboarding_status"]
          onboarding_submitted_at: string | null
          provider_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document: string
          email_dispatched_at?: string | null
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          netcred_bank_account_id?: string | null
          netcred_company_id?: string | null
          onboarding_activated_at?: string | null
          onboarding_status?: Database["public"]["Enums"]["payment_provider_onboarding_status"]
          onboarding_submitted_at?: string | null
          provider_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string
          email_dispatched_at?: string | null
          gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          id?: string
          netcred_bank_account_id?: string | null
          netcred_company_id?: string | null
          onboarding_activated_at?: string | null
          onboarding_status?: Database["public"]["Enums"]["payment_provider_onboarding_status"]
          onboarding_submitted_at?: string | null
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_gateway_accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_latest_locations: {
        Row: {
          device_id: string | null
          h3_index: number | null
          location: unknown
          location_accuracy_meters: number | null
          location_recorded_at: string | null
          provider_id: string
          updated_at: string
        }
        Insert: {
          device_id?: string | null
          h3_index?: number | null
          location?: unknown
          location_accuracy_meters?: number | null
          location_recorded_at?: string | null
          provider_id: string
          updated_at?: string
        }
        Update: {
          device_id?: string | null
          h3_index?: number | null
          location?: unknown
          location_accuracy_meters?: number | null
          location_recorded_at?: string | null
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_latest_locations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          address_proof_storage_path: string | null
          bank_account: string | null
          bank_branch: string | null
          bank_institution_code: string | null
          cnpj: string | null
          commercial_contact: string | null
          corporate_charter_storage_path: string | null
          cpf: string | null
          entity_type: string
          identity_doc_storage_path: string | null
          legal_rep_doc_storage_path: string | null
          legal_representative_cpf: string | null
          legal_representative_name: string | null
          legal_representative_phone: string | null
          nome_fantasia: string | null
          pix_key: string | null
          provider_id: string
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          address_proof_storage_path?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_institution_code?: string | null
          cnpj?: string | null
          commercial_contact?: string | null
          corporate_charter_storage_path?: string | null
          cpf?: string | null
          entity_type?: string
          identity_doc_storage_path?: string | null
          legal_rep_doc_storage_path?: string | null
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          legal_representative_phone?: string | null
          nome_fantasia?: string | null
          pix_key?: string | null
          provider_id: string
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          address_proof_storage_path?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_institution_code?: string | null
          cnpj?: string | null
          commercial_contact?: string | null
          corporate_charter_storage_path?: string | null
          cpf?: string | null
          entity_type?: string
          identity_doc_storage_path?: string | null
          legal_rep_doc_storage_path?: string | null
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          legal_representative_phone?: string | null
          nome_fantasia?: string | null
          pix_key?: string | null
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
      provider_proposal_stats: {
        Row: {
          accepted_count: number
          provider_id: string
          ranking_conversion_score: number
          resolved_count: number
          updated_at: string
        }
        Insert: {
          accepted_count?: number
          provider_id: string
          ranking_conversion_score?: number
          resolved_count?: number
          updated_at?: string
        }
        Update: {
          accepted_count?: number
          provider_id?: string
          ranking_conversion_score?: number
          resolved_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_proposal_stats_provider_id_fkey"
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
      provider_rating_stats: {
        Row: {
          overall_avg: number | null
          provider_id: string
          ranking_quality_score: number
          rating_count: number
          updated_at: string
        }
        Insert: {
          overall_avg?: number | null
          provider_id: string
          ranking_quality_score?: number
          rating_count?: number
          updated_at?: string
        }
        Update: {
          overall_avg?: number | null
          provider_id?: string
          ranking_quality_score?: number
          rating_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_rating_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      service_ratings: {
        Row: {
          client_id: string
          comment: string | null
          contracted_service_id: string
          id: string
          overall_score: number
          provider_id: string
          score_communication: number
          score_punctuality: number
          score_quality: number
          score_value: number
          service_request_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          contracted_service_id: string
          id?: string
          overall_score: number
          provider_id: string
          score_communication: number
          score_punctuality: number
          score_quality: number
          score_value: number
          service_request_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          contracted_service_id?: string
          id?: string
          overall_score?: number
          provider_id?: string
          score_communication?: number
          score_punctuality?: number
          score_quality?: number
          score_value?: number
          service_request_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_contracted_service_id_fkey"
            columns: ["contracted_service_id"]
            isOneToOne: true
            referencedRelation: "contracted_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_dispatch_batch_providers: {
        Row: {
          batch_id: string
          created_at: string
          device_id: string | null
          id: string
          provider_id: string
          ranking_score: number
          score_components: Json
        }
        Insert: {
          batch_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          provider_id: string
          ranking_score: number
          score_components?: Json
        }
        Update: {
          batch_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          provider_id?: string
          ranking_score?: number
          score_components?: Json
        }
        Relationships: [
          {
            foreignKeyName: "service_request_dispatch_batch_providers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "service_request_dispatch_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_dispatch_batch_providers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_dispatch_batches: {
        Row: {
          batch_number: number
          created_at: string
          dispatch_id: string
          explored_h3_cells: Json | null
          id: string
          opened_at: string
        }
        Insert: {
          batch_number: number
          created_at?: string
          dispatch_id: string
          explored_h3_cells?: Json | null
          id?: string
          opened_at?: string
        }
        Update: {
          batch_number?: number
          created_at?: string
          dispatch_id?: string
          explored_h3_cells?: Json | null
          id?: string
          opened_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_dispatch_batches_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "service_request_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_dispatch_events: {
        Row: {
          created_at: string
          dispatch_id: string
          event_type: Database["public"]["Enums"]["service_request_dispatch_event_type"]
          id: string
          payload: Json
          provider_id: string | null
          service_request_id: string
        }
        Insert: {
          created_at?: string
          dispatch_id: string
          event_type: Database["public"]["Enums"]["service_request_dispatch_event_type"]
          id?: string
          payload?: Json
          provider_id?: string | null
          service_request_id: string
        }
        Update: {
          created_at?: string
          dispatch_id?: string
          event_type?: Database["public"]["Enums"]["service_request_dispatch_event_type"]
          id?: string
          payload?: Json
          provider_id?: string | null
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_dispatch_events_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "service_request_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_dispatch_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_dispatch_events_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_dispatches: {
        Row: {
          batch_sequence: number
          created_at: string
          fallback_opened_at: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          next_batch_at: string | null
          service_request_id: string
          status: Database["public"]["Enums"]["service_request_dispatch_status"]
          updated_at: string
        }
        Insert: {
          batch_sequence?: number
          created_at?: string
          fallback_opened_at?: string | null
          id?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          next_batch_at?: string | null
          service_request_id: string
          status?: Database["public"]["Enums"]["service_request_dispatch_status"]
          updated_at?: string
        }
        Update: {
          batch_sequence?: number
          created_at?: string
          fallback_opened_at?: string | null
          id?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          next_batch_at?: string | null
          service_request_id?: string
          status?: Database["public"]["Enums"]["service_request_dispatch_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_dispatches_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
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
      service_request_provider_visibility: {
        Row: {
          batch_id: string | null
          created_at: string
          dismissed_at: string | null
          granted_at: string | null
          id: string
          provider_id: string
          revoked_at: string | null
          service_request_id: string
          source: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          granted_at?: string | null
          id?: string
          provider_id: string
          revoked_at?: string | null
          service_request_id: string
          source: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          granted_at?: string | null
          id?: string
          provider_id?: string
          revoked_at?: string | null
          service_request_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_provider_visibility_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "service_request_dispatch_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_provider_visibility_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_provider_visibility_service_request_id_fkey"
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
          h3_index: number | null
          ios_version: number | null
          is_virtual: boolean
          location: unknown
          location_accuracy_meters: number | null
          location_permission_granted: boolean
          location_recorded_at: string | null
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
          h3_index?: number | null
          ios_version?: number | null
          is_virtual?: boolean
          location?: unknown
          location_accuracy_meters?: number | null
          location_permission_granted?: boolean
          location_recorded_at?: string | null
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
          h3_index?: number | null
          ios_version?: number | null
          is_virtual?: boolean
          location?: unknown
          location_accuracy_meters?: number | null
          location_permission_granted?: boolean
          location_recorded_at?: string | null
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
      client_card_tokens_safe_v: {
        Row: {
          card_brand: string | null
          card_number_masked: string | null
          cardholder_name: string | null
          client_id: string | null
          created_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          gateway_payment_profile_id: string | null
          gateway_slug:
            | Database["public"]["Enums"]["payment_gateway_slug"]
            | null
          id: string | null
          state:
            | Database["public"]["Enums"]["payment_client_card_token_state"]
            | null
          updated_at: string | null
        }
        Insert: {
          card_brand?: string | null
          card_number_masked?: string | null
          cardholder_name?: string | null
          client_id?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          gateway_payment_profile_id?: string | null
          gateway_slug?:
            | Database["public"]["Enums"]["payment_gateway_slug"]
            | null
          id?: string | null
          state?:
            | Database["public"]["Enums"]["payment_client_card_token_state"]
            | null
          updated_at?: string | null
        }
        Update: {
          card_brand?: string | null
          card_number_masked?: string | null
          cardholder_name?: string | null
          client_id?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          gateway_payment_profile_id?: string | null
          gateway_slug?:
            | Database["public"]["Enums"]["payment_gateway_slug"]
            | null
          id?: string | null
          state?:
            | Database["public"]["Enums"]["payment_client_card_token_state"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_card_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_transactions_v: {
        Row: {
          amount_paid: number | null
          client_id: string | null
          contracted_service_id: string | null
          created_at: string | null
          installment_number: number | null
          is_disputed: boolean | null
          paid_at: string | null
          refunded_amount: number | null
          refunded_at: string | null
          schedule_id: string | null
          service_amount: number | null
          state: Database["public"]["Enums"]["payment_schedule_state"] | null
        }
        Insert: {
          amount_paid?: number | null
          client_id?: string | null
          contracted_service_id?: string | null
          created_at?: string | null
          installment_number?: number | null
          is_disputed?: boolean | null
          paid_at?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          schedule_id?: string | null
          service_amount?: number | null
          state?: Database["public"]["Enums"]["payment_schedule_state"] | null
        }
        Update: {
          amount_paid?: number | null
          client_id?: string | null
          contracted_service_id?: string | null
          created_at?: string | null
          installment_number?: number | null
          is_disputed?: boolean | null
          paid_at?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          schedule_id?: string | null
          service_amount?: number | null
          state?: Database["public"]["Enums"]["payment_schedule_state"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_contracted_service_id_fkey"
            columns: ["contracted_service_id"]
            isOneToOne: true
            referencedRelation: "contracted_services"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_payment_receivables_v: {
        Row: {
          amount_received_at_capture: number | null
          contracted_service_id: string | null
          created_at: string | null
          is_disputed: boolean | null
          net_amount_received: number | null
          provider_id: string | null
          received_at: string | null
          refunded_amount: number | null
          refunded_at: string | null
          schedule_id: string | null
          state: Database["public"]["Enums"]["payment_schedule_state"] | null
        }
        Insert: {
          amount_received_at_capture?: number | null
          contracted_service_id?: string | null
          created_at?: string | null
          is_disputed?: boolean | null
          net_amount_received?: never
          provider_id?: string | null
          received_at?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          schedule_id?: string | null
          state?: Database["public"]["Enums"]["payment_schedule_state"] | null
        }
        Update: {
          amount_received_at_capture?: number | null
          contracted_service_id?: string | null
          created_at?: string | null
          is_disputed?: boolean | null
          net_amount_received?: never
          provider_id?: string | null
          received_at?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          schedule_id?: string | null
          state?: Database["public"]["Enums"]["payment_schedule_state"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_contracted_service_id_fkey"
            columns: ["contracted_service_id"]
            isOneToOne: true
            referencedRelation: "contracted_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_proposal:
        | {
            Args: {
              p_idempotency_key: string
              p_proposal_id: string
              p_selected_slot: Json
            }
            Returns: Json
          }
        | {
            Args: {
              p_clearsale_session_id: string
              p_client_card_token_id: string
              p_client_ip: string
              p_idempotency_key: string
              p_installment_hmac_payload: Json
              p_installment_number: number
              p_installment_selection_hmac: string
              p_pricing_signature: string
              p_proposal_id: string
              p_selected_slot: Json
            }
            Returns: Json
          }
      acquire_or_refresh_netcred_token: {
        Args: {
          p_expires_at?: string
          p_is_sandbox?: boolean
          p_new_token?: string
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
      cns_chat_is_unread_for_user: {
        Args: { p_chat_id: string; p_user_id: string }
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
      cns_notify_chat_message: { Args: { p_message_id: string }; Returns: Json }
      cns_notify_conversation_closed: {
        Args: { p_chat_id: string }
        Returns: Json
      }
      cns_project_message_payload_for_list: {
        Args: {
          p_message_type: Database["public"]["Enums"]["cns_message_type"]
          p_payload: Json
        }
        Returns: Json
      }
      cns_prune_chat_rate_limit_buckets: {
        Args: { p_batch_limit?: number; p_retention_hours?: number }
        Returns: Json
      }
      cns_prune_job_runs: {
        Args: { p_batch_limit?: number; p_retention_days?: number }
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
          p_idempotency_key: string
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
      create_request_quote_service_request: {
        Args: {
          p_actor_user_id: string
          p_address_id: string
          p_description: string
          p_estimated_duration_hint: string
          p_form_data: Json
          p_form_schema: Json
          p_form_version: string
          p_idempotency_key: string
          p_missing_info_warnings: string[]
          p_photo_urls: string[]
          p_request_hash: string
          p_request_title: string
          p_scope_complexity: string
          p_service_id: string
          p_suggested_equipment: string[]
          p_suggested_materials: string[]
          p_tags: string[]
          p_urgency: string
        }
        Returns: Json
      }
      cron_chat_evaluate_reciprocity: { Args: never; Returns: Json }
      cron_cns_janitor_orphan_media: { Args: never; Returns: Json }
      cron_cns_prune_chat_rate_limit_buckets: { Args: never; Returns: Json }
      cron_cns_prune_job_runs: { Args: never; Returns: Json }
      cron_cns_reconcile_pending_deliveries: { Args: never; Returns: Json }
      cron_enqueue_proposal_expiring_soon_reminders: {
        Args: never
        Returns: Json
      }
      cron_payment_charge_batch: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      cron_payment_recover_orphaned_schedules: { Args: never; Returns: Json }
      cron_process_service_request_dispatches: { Args: never; Returns: Json }
      cron_proposal_expire_pending: { Args: never; Returns: Json }
      cron_purge_stale_user_device_beacons: { Args: never; Returns: Json }
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
      dismiss_provider_opportunity: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      domain_events_release_stale_leases: { Args: never; Returns: number }
      enqueue_proposal_expiring_soon_reminders: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      evaluate_service_request_dispatch_gates: {
        Args: { p_service_request_id: string }
        Returns: undefined
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
      idempotency_begin_for_actor: {
        Args: {
          p_actor_user_id: string
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
      idempotency_commit_for_actor: {
        Args: {
          p_actor_user_id: string
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
      list_conversations: {
        Args: {
          p_cursor_id?: string
          p_cursor_last_interaction_at?: string
          p_page_size?: number
          p_service_request_id?: string
        }
        Returns: Json
      }
      list_proposal_versions: { Args: { p_chat_id: string }; Returns: Json }
      list_provider_opportunities: {
        Args: {
          p_cursor?: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_provider_id: string
          p_sort_mode?: string
        }
        Returns: Json
      }
      list_provider_proposal_history: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      list_provider_scheduled_services: {
        Args: { p_from_date: string; p_to_date: string }
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
      matching_acquire_dispatch_lease: {
        Args: { p_dispatch_id: string; p_owner: string; p_ttl_seconds?: number }
        Returns: boolean
      }
      matching_cancel_pending_mmd_for_service_request: {
        Args: { p_service_request_id: string; p_template_prefix?: string }
        Returns: number
      }
      matching_compute_explored_h3_cells: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      matching_decode_feed_cursor: { Args: { p_cursor: string }; Returns: Json }
      matching_discover_candidates: {
        Args: { p_limit?: number; p_service_request_id: string }
        Returns: {
          device_id: string
          distance_meters: number
          has_valid_beacon: boolean
          provider_id: string
        }[]
      }
      matching_encode_feed_cursor: {
        Args: { p_payload: Json }
        Returns: string
      }
      matching_force_release_stale_leases: {
        Args: { p_batch_limit?: number; p_stale_after?: string }
        Returns: Json
      }
      matching_h3_bigint_to_hex: { Args: { p_cell: number }; Returns: string }
      matching_h3_cell_at_matching_resolution: {
        Args: { p_address_h3: string; p_location: unknown }
        Returns: number
      }
      matching_h3_cell_to_parent: {
        Args: { p_cell: number; p_parent_res: number }
        Returns: number
      }
      matching_h3_hex_to_bigint: { Args: { p_hex: string }; Returns: number }
      matching_h3_parse_index: { Args: { p_index: string }; Returns: number }
      matching_h3_ring_cells: {
        Args: { p_center_h3: number; p_resolution: number }
        Returns: number[]
      }
      matching_latlng_to_h3_cell: {
        Args: { p_location: unknown; p_resolution: number }
        Returns: number
      }
      matching_open_batch: {
        Args: { p_dispatch_id: string }
        Returns: undefined
      }
      matching_ops_consecutive_cron_errors: {
        Args: { p_lookback?: number; p_threshold?: number }
        Returns: Json
      }
      matching_process_dispatch_row: {
        Args: { p_dispatch_id: string; p_job_run_id?: number }
        Returns: undefined
      }
      matching_provider_has_opportunity_access: {
        Args: { p_provider_id: string; p_service_request_id: string }
        Returns: boolean
      }
      matching_rank_candidates: {
        Args: { p_candidates: string[]; p_service_request_id: string }
        Returns: {
          device_id: string
          provider_id: string
          ranking_score: number
          score_components: Json
        }[]
      }
      matching_rank_candidates_with_discover: {
        Args: { p_discovered: Json; p_service_request_id: string }
        Returns: {
          device_id: string
          provider_id: string
          ranking_score: number
          score_components: Json
        }[]
      }
      matching_refresh_provider_latest_location: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      matching_refresh_provider_proposal_stats: {
        Args: { p_provider_id: string }
        Returns: undefined
      }
      matching_refresh_provider_rating_stats: {
        Args: { p_provider_id: string }
        Returns: undefined
      }
      matching_release_dispatch_lease: {
        Args: { p_dispatch_id: string }
        Returns: undefined
      }
      matching_renew_dispatch_lease: {
        Args: { p_dispatch_id: string; p_owner: string; p_ttl_seconds?: number }
        Returns: boolean
      }
      mmd_idempotency_uuid: { Args: { p_key: string }; Returns: string }
      mmd_ingest_event: {
        Args: {
          p_event_type: string
          p_idempotency_key: string
          p_metadata?: Json
          p_recipient_profile_id: string
          p_template_variables: Json
        }
        Returns: Json
      }
      notify_proposal_accepted: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      notify_proposal_expired: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      notify_proposal_mmd: {
        Args: {
          p_actor_id: string
          p_event_type: string
          p_idempotency_key: string
          p_message_preview: string
          p_metadata?: Json
          p_proposal_id: string
          p_recipient_id: string
        }
        Returns: Json
      }
      notify_proposal_rejected: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      notify_proposal_revision_requested: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      notify_proposal_submitted: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      payment_activate_provider_from_netcred: {
        Args: {
          p_netcred_bank_account_id: string
          p_netcred_company_id: string
          p_provider_gateway_account_id: string
        }
        Returns: Json
      }
      payment_assert_installment_hmac_context: {
        Args: {
          p_base_amount: number
          p_card_brand: string
          p_installment_number: number
          p_payload: Json
          p_proposal_id: string
          p_service_id: string
          p_submitted_hmac: string
        }
        Returns: undefined
      }
      payment_assert_provider_kyc_storage_path: {
        Args: {
          p_document_key: string
          p_provider_id: string
          p_storage_path: string
        }
        Returns: undefined
      }
      payment_auto_cancel_services: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_auto_complete_executed_services: { Args: never; Returns: Json }
      payment_begin_manual_attempt: {
        Args: {
          p_actor_id?: string
          p_clearsale_session_id: string
          p_client_id: string
          p_client_ip_address?: string
          p_schedule_id: string
        }
        Returns: Json
      }
      payment_begin_refund_request: {
        Args: {
          p_actor_id: string
          p_cancellation_reason?: string
          p_initiator?: string
          p_service_id: string
        }
        Returns: Json
      }
      payment_calculate_charge_amount: {
        Args: {
          p_base_amount: number
          p_client_card_token_id: string
          p_installment_number: number
        }
        Returns: number
      }
      payment_calculate_installment_options: {
        Args: {
          p_card_brand: string
          p_proposal_id: string
          p_service_id: string
        }
        Returns: Json
      }
      payment_calculate_refund_amount: {
        Args: {
          p_base_amount: number
          p_charge_amount: number
          p_initiator: string
          p_now?: string
          p_service_scheduled_at: string
        }
        Returns: Json
      }
      payment_cc_fee_rate_key: {
        Args: { p_card_brand: string; p_installment_number: number }
        Returns: string
      }
      payment_claim_charge_batch: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_claim_stale_schedules_for_reconciliation: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_claim_upcoming_charge_notifications: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_claim_webhook_processing_batch: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_claim_webhook_retry_batch: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_client_card_token_is_expired: {
        Args: { p_expiry_month: number; p_expiry_year: number }
        Returns: boolean
      }
      payment_commit_charge_outcome: {
        Args: {
          p_actor_id?: string
          p_charge_amount: number
          p_failure_code?: string
          p_failure_reason?: string
          p_gateway_charge_id?: string
          p_gateway_latency_ms?: number
          p_gateway_transaction_id?: string
          p_initiator?: string
          p_outcome: string
          p_provider_response_summary?: Json
          p_schedule_id: string
          p_undo_attempt_increment?: boolean
        }
        Returns: string
      }
      payment_compute_charge_scheduled_at: {
        Args: {
          p_cs: Database["public"]["Tables"]["contracted_services"]["Row"]
        }
        Returns: string
      }
      payment_confirm_upcoming_charge_notified: {
        Args: { p_schedule_id: string }
        Returns: boolean
      }
      payment_cron_auto_cancel_unpaid_services: {
        Args: never
        Returns: undefined
      }
      payment_cron_auto_complete_executed_services: {
        Args: never
        Returns: undefined
      }
      payment_cron_detect_netcred_onboarding: {
        Args: never
        Returns: undefined
      }
      payment_cron_invoke_edge_function: {
        Args: { p_function_name: string }
        Returns: number
      }
      payment_cron_notify_upcoming_charges: { Args: never; Returns: undefined }
      payment_cron_process_webhook_retry: { Args: never; Returns: undefined }
      payment_cron_reconcile_netcred_payments: {
        Args: never
        Returns: undefined
      }
      payment_cron_recover_orphaned_schedules: {
        Args: never
        Returns: undefined
      }
      payment_cron_schedule_netcred_charges: { Args: never; Returns: undefined }
      payment_enqueue_notifications: {
        Args: {
          p_metadata?: Json
          p_notification_event: string
          p_schedule_id: string
        }
        Returns: Json
      }
      payment_enqueue_webhook_processing: {
        Args: { p_scheduled_at?: string; p_webhook_event_id: string }
        Returns: Json
      }
      payment_finish_webhook_retry_failure: {
        Args: {
          p_event_id: string
          p_failure_reason: string
          p_queue_id?: string
        }
        Returns: Json
      }
      payment_get_checkout_step_requirements: { Args: never; Returns: Json }
      payment_get_proposal_checkout_context: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      payment_increment_reconciliation_failure: {
        Args: { p_schedule_id: string }
        Returns: number
      }
      payment_ingest_webhook_event: {
        Args: {
          p_event_type: string
          p_gateway_event_id: string
          p_gateway_slug: Database["public"]["Enums"]["payment_gateway_slug"]
          p_raw_headers: Json
          p_raw_payload: Json
        }
        Returns: Json
      }
      payment_installment_hmac_canonical_text: {
        Args: { p_payload: Json }
        Returns: string
      }
      payment_list_gateway_accounts_for_onboarding: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_mark_kyc_credenciamento_email_dispatched: {
        Args: { p_provider_gateway_account_id: string }
        Returns: undefined
      }
      payment_mark_service_executed: {
        Args: { p_service_id: string }
        Returns: Json
      }
      payment_notify_upcoming_charges_batch: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      payment_persist_client_card_token: {
        Args: {
          p_billing_address: Json
          p_card_brand: string
          p_card_number_masked: string
          p_cardholder_name: string
          p_client_id: string
          p_expiry_month: number
          p_expiry_year: number
          p_gateway_card_token: string
          p_gateway_payment_profile_id: string
          p_gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
        }
        Returns: Json
      }
      payment_pre_charge_cancel: {
        Args: {
          p_actor_id: string
          p_cancellation_reason?: string
          p_initiator?: string
          p_service_id: string
        }
        Returns: string
      }
      payment_process_reconciliation_outcome: {
        Args: {
          p_gateway_charge_id?: string
          p_gateway_state: string
          p_gateway_transaction_id?: string
          p_paid_amount?: number
          p_refunded_amount?: number
          p_schedule_id: string
        }
        Returns: Json
      }
      payment_process_webhook_event: {
        Args: { p_webhook_event_id: string }
        Returns: Json
      }
      payment_provider_is_credentialed: {
        Args: {
          p_gateway_slug?: Database["public"]["Enums"]["payment_gateway_slug"]
          p_provider_id: string
        }
        Returns: boolean
      }
      payment_provider_kyc_document_key_valid: {
        Args: { p_document_key: string }
        Returns: boolean
      }
      payment_provider_kyc_storage_mutations_allowed: {
        Args: never
        Returns: boolean
      }
      payment_provider_kyc_storage_path_valid: {
        Args: { p_provider_id: string; p_storage_path: string }
        Returns: boolean
      }
      payment_reconstruct_audit_lifecycle: {
        Args: { p_service_id: string }
        Returns: Json
      }
      payment_recover_orphaned_schedules: {
        Args: never
        Returns: {
          recovered_count: number
          recovered_to_failed: number
          recovered_to_scheduled: number
        }[]
      }
      payment_recover_stuck_webhook_processing: {
        Args: { p_stale_minutes?: number }
        Returns: Json
      }
      payment_reschedule_charge_date: {
        Args: { p_contracted_service_id: string }
        Returns: Json
      }
      payment_reset_dead_letter_event: {
        Args: { p_event_id: string }
        Returns: Json
      }
      payment_revert_dry_run_lease: {
        Args: { p_attempt_count: number; p_schedule_id: string }
        Returns: undefined
      }
      payment_revoke_client_card_token: {
        Args: { p_client_card_token_id: string }
        Returns: Json
      }
      payment_round_half_even: {
        Args: { p_scale?: number; p_value: number }
        Returns: number
      }
      payment_sanitize_webhook_headers: {
        Args: { p_headers: Json }
        Returns: Json
      }
      payment_service_execution_at: {
        Args: {
          p_cs: Database["public"]["Tables"]["contracted_services"]["Row"]
        }
        Returns: string
      }
      payment_submit_provider_kyc: {
        Args: {
          p_address_proof_storage_path: string
          p_bank_account: string
          p_bank_branch: string
          p_bank_institution_code: string
          p_corporate_charter_storage_path?: string
          p_identity_doc_storage_path: string
          p_legal_rep_doc_storage_path?: string
          p_legal_representative_phone?: string
          p_phone?: string
          p_pix_key?: string
        }
        Returns: Json
      }
      payment_total_with_card_fees: {
        Args: {
          p_base_amount: number
          p_card_brand: string
          p_installment_number: number
        }
        Returns: number
      }
      payment_update_method: {
        Args: {
          p_installment_hmac_payload?: Json
          p_installment_selection_hmac?: string
          p_new_client_card_token_id: string
          p_service_id: string
        }
        Returns: Json
      }
      payment_update_provider_onboarding_status: {
        Args: {
          p_onboarding_status: Database["public"]["Enums"]["payment_provider_onboarding_status"]
          p_provider_gateway_account_id: string
        }
        Returns: Json
      }
      payment_update_webhook_event_state: {
        Args: {
          p_failure_reason?: string
          p_target_state: Database["public"]["Enums"]["payment_webhook_event_state"]
          p_webhook_event_id: string
        }
        Returns: Json
      }
      payment_validate_tokenize_checkout_access: {
        Args: { p_client_id: string; p_proposal_id: string }
        Returns: Json
      }
      payment_verify_installment_selection_hmac: {
        Args: { p_payload: Json; p_submitted_hmac: string }
        Returns: undefined
      }
      payment_webhook_handle_capture: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_dispute: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_expired: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_profile_delete: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_profile_expiring: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_profile_tokenize: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_profile_update: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_refund: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_rejected: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_transaction_update: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_handle_void: {
        Args: { p_payload: Json; p_webhook_event_id: string }
        Returns: Json
      }
      payment_webhook_payload_reference_code: {
        Args: { p_payload: Json }
        Returns: string
      }
      payment_webhook_payload_text: {
        Args: { p_paths: string[]; p_payload: Json }
        Returns: string
      }
      payment_webhook_payload_transaction_state: {
        Args: { p_payload: Json }
        Returns: string
      }
      payment_write_audit: {
        Args: {
          p_actor?: Database["public"]["Enums"]["payment_audit_actor"]
          p_actor_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_from_state?: string
          p_metadata?: Json
          p_schedule_id?: string
          p_service_id?: string
          p_to_state?: string
        }
        Returns: string
      }
      payment_write_event: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_event_type: string
          p_payload?: Json
          p_service_id?: string
        }
        Returns: string
      }
      platform_check_rate_limit: {
        Args: { p_key: string; p_per_minute: number; p_window_ms?: number }
        Returns: Json
      }
      platform_constant_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      platform_constant_int: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      platform_constant_numeric: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      project_service_row: {
        Args: { p_service_request_id: string; p_viewer_id: string }
        Returns: Json
      }
      provider_sees_full_service_address: {
        Args: { p_provider_id: string; p_service_request_id: string }
        Returns: boolean
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
      record_provider_opportunity_view: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      reject_non_terminal_proposals_on_sr_cancel: {
        Args: {
          p_client_rejection_response?: string
          p_service_request_id: string
        }
        Returns: number
      }
      reject_proposal: {
        Args: {
          p_idempotency_key: string
          p_proposal_id: string
          p_rejection_reason: string
        }
        Returns: Json
      }
      release_netcred_token_refresh_lock: { Args: never; Returns: undefined }
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
      request_quote_order_request_hash: {
        Args: {
          p_address: Json
          p_description: string
          p_form_data: Json
          p_form_version: string
          p_photo_count: number
          p_photo_total_bytes: number
          p_request_title: string
          p_service_id: string
          p_structured_data: Json
          p_user_id: string
        }
        Returns: string
      }
      resolve_proposal_chat_id: {
        Args: { p_provider_id: string; p_service_request_id: string }
        Returns: string
      }
      sanitize_job_error: { Args: { p_message: string }; Returns: string }
      service_row_last_activity_at: {
        Args: {
          p_service_request_id: string
          p_viewer_id: string
          p_viewer_role: string
        }
        Returns: string
      }
      service_viewer_has_access: {
        Args: { p_service_request_id: string; p_viewer_id: string }
        Returns: boolean
      }
      slugify_for_provider: { Args: { name_input: string }; Returns: string }
      submit_service_rating: {
        Args: {
          p_comment?: string
          p_contracted_service_id: string
          p_score_communication: number
          p_score_punctuality: number
          p_score_quality: number
          p_score_value: number
        }
        Returns: Json
      }
      update_service_rating: {
        Args: {
          p_comment?: string
          p_contracted_service_id: string
          p_score_communication: number
          p_score_punctuality: number
          p_score_quality: number
          p_score_value: number
        }
        Returns: Json
      }
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
        | "PROPOSAL_REJECTED"
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
      contracted_service_status:
        | "PENDING_PAYMENT"
        | "COMPLETED"
        | "CANCELLED"
        | "CONFIRMED"
        | "EXECUTED"
      payment_attempt_initiator: "cron" | "client"
      payment_attempt_outcome:
        | "PAID"
        | "REJECTED"
        | "TIMEOUT"
        | "ERROR"
        | "IN_ANALYSIS"
        | "VOIDED"
      payment_audit_actor:
        | "cron"
        | "client"
        | "provider"
        | "webhook"
        | "support"
        | "system"
      payment_client_card_token_state:
        | "ACTIVE"
        | "EXPIRED"
        | "REVOKED"
        | "TOKENIZATION_FAILED"
      payment_gateway_slug: "netcred"
      payment_provider_onboarding_status:
        | "PENDING_DOCUMENTS"
        | "DOCUMENTS_SUBMITTED"
        | "UNDER_NETCRED_REVIEW"
        | "ACTIVE"
        | "REJECTED"
        | "SUSPENDED"
      payment_schedule_state:
        | "SCHEDULED"
        | "PROCESSING"
        | "PAID"
        | "IN_ANALYSIS"
        | "FAILED"
        | "FAILED_PERMANENT"
        | "CANCELLED"
        | "VOIDED"
        | "REFUND_REQUESTED"
        | "REFUNDED"
        | "PARTIALLY_REFUNDED"
        | "EXPIRED"
      payment_webhook_event_state:
        | "RECEIVED"
        | "VALIDATING"
        | "PROCESSING"
        | "PROCESSED"
        | "DUPLICATE"
        | "FAILED"
        | "DEAD_LETTER"
      payment_webhook_queue_state:
        | "PENDING"
        | "PROCESSING"
        | "PROCESSED"
        | "FAILED"
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
      provider_operational_status: "active" | "suspended"
      service_request_dispatch_event_type:
        | "state_transition"
        | "batch_opened"
        | "pool_exhausted"
        | "provider_viewed"
        | "provider_declined"
        | "dispatch_expired"
        | "dispatch_paused"
        | "dispatch_resumed"
      service_request_dispatch_status:
        | "DISPATCH_PENDING"
        | "DISPATCH_ACTIVE"
        | "DISPATCH_PAUSED"
        | "DISPATCH_STOPPED"
        | "DISPATCH_MATCHED"
        | "DISPATCH_FALLBACK_OPEN_MARKET"
        | "DISPATCH_CANCELLED"
        | "DISPATCH_EXPIRED"
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
        "PROPOSAL_REJECTED",
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
      contracted_service_status: [
        "PENDING_PAYMENT",
        "COMPLETED",
        "CANCELLED",
        "CONFIRMED",
        "EXECUTED",
      ],
      payment_attempt_initiator: ["cron", "client"],
      payment_attempt_outcome: [
        "PAID",
        "REJECTED",
        "TIMEOUT",
        "ERROR",
        "IN_ANALYSIS",
        "VOIDED",
      ],
      payment_audit_actor: [
        "cron",
        "client",
        "provider",
        "webhook",
        "support",
        "system",
      ],
      payment_client_card_token_state: [
        "ACTIVE",
        "EXPIRED",
        "REVOKED",
        "TOKENIZATION_FAILED",
      ],
      payment_gateway_slug: ["netcred"],
      payment_provider_onboarding_status: [
        "PENDING_DOCUMENTS",
        "DOCUMENTS_SUBMITTED",
        "UNDER_NETCRED_REVIEW",
        "ACTIVE",
        "REJECTED",
        "SUSPENDED",
      ],
      payment_schedule_state: [
        "SCHEDULED",
        "PROCESSING",
        "PAID",
        "IN_ANALYSIS",
        "FAILED",
        "FAILED_PERMANENT",
        "CANCELLED",
        "VOIDED",
        "REFUND_REQUESTED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
        "EXPIRED",
      ],
      payment_webhook_event_state: [
        "RECEIVED",
        "VALIDATING",
        "PROCESSING",
        "PROCESSED",
        "DUPLICATE",
        "FAILED",
        "DEAD_LETTER",
      ],
      payment_webhook_queue_state: [
        "PENDING",
        "PROCESSING",
        "PROCESSED",
        "FAILED",
      ],
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
      provider_operational_status: ["active", "suspended"],
      service_request_dispatch_event_type: [
        "state_transition",
        "batch_opened",
        "pool_exhausted",
        "provider_viewed",
        "provider_declined",
        "dispatch_expired",
        "dispatch_paused",
        "dispatch_resumed",
      ],
      service_request_dispatch_status: [
        "DISPATCH_PENDING",
        "DISPATCH_ACTIVE",
        "DISPATCH_PAUSED",
        "DISPATCH_STOPPED",
        "DISPATCH_MATCHED",
        "DISPATCH_FALLBACK_OPEN_MARKET",
        "DISPATCH_CANCELLED",
        "DISPATCH_EXPIRED",
      ],
      service_request_status: ["OPEN", "COMPLETED", "CANCELLED"],
    },
  },
} as const

