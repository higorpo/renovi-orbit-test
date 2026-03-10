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
      ai_prompt_usage: {
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
            foreignKeyName: "ai_prompt_usage_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_usage_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
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
      client_addresses: {
        Row: {
          city: string
          client_id: string
          complement: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at: string
          zip_code: string
        }
        Insert: {
          city: string
          client_id: string
          complement?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at?: string
          zip_code: string
        }
        Update: {
          city?: string
          client_id?: string
          complement?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          neighborhood?: string
          number?: string
          state?: string
          street?: string
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
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
          full_name: string
          id: string
          role: string
        }
        Insert: {
          full_name?: string
          id: string
          role?: string
        }
        Update: {
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      rate_limits: {
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
      service_requests: {
        Row: {
          address_id: string | null
          city: string | null
          client_id: string
          created_at: string
          description: string | null
          form_data: Json | null
          form_schema: Json | null
          form_version: string | null
          id: string
          neighborhood: string | null
          photos: string[] | null
          service_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          form_data?: Json | null
          form_schema?: Json | null
          form_version?: string | null
          id?: string
          neighborhood?: string | null
          photos?: string[] | null
          service_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          form_data?: Json | null
          form_schema?: Json | null
          form_version?: string | null
          id?: string
          neighborhood?: string | null
          photos?: string[] | null
          service_id?: string
          status?: string
          title?: string
          updated_at?: string
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
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          ai_prompt_id: string | null
          created_at: string
          description: string | null
          form_id: string | null
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
          created_at?: string
          description?: string | null
          form_id?: string | null
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
          created_at?: string
          description?: string | null
          form_id?: string | null
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
            foreignKeyName: "services_ai_prompt_id_fkey"
            columns: ["ai_prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_prompt_by_key: { Args: { p_prompt_key: string }; Returns: Json }
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

