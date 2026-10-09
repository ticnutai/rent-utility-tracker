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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_members: {
        Row: {
          created_at: string
          id: string
          member_email: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_email: string
          owner_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_email?: string
          owner_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          apartment: string
          created_at: string
          end_date: string | null
          file_name: string | null
          file_path: string | null
          id: string
          landlord_id_number: string
          landlord_name: string
          monthly_rent: number
          notes: string
          option_exercised: boolean
          option_months: number
          option_rent: number
          start_date: string | null
          tenant_id_number: string
          tenant_name: string
          tenant_phone: string
          user_id: string
        }
        Insert: {
          apartment?: string
          created_at?: string
          end_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          landlord_id_number?: string
          landlord_name?: string
          monthly_rent?: number
          notes?: string
          option_exercised?: boolean
          option_months?: number
          option_rent?: number
          start_date?: string | null
          tenant_id_number?: string
          tenant_name?: string
          tenant_phone?: string
          user_id?: string
        }
        Update: {
          apartment?: string
          created_at?: string
          end_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          landlord_id_number?: string
          landlord_name?: string
          monthly_rent?: number
          notes?: string
          option_exercised?: boolean
          option_months?: number
          option_rent?: number
          start_date?: string | null
          tenant_id_number?: string
          tenant_name?: string
          tenant_phone?: string
          user_id?: string
        }
        Relationships: []
      }
      migration_admins: {
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
      migration_runner_logs: {
        Row: {
          error: string | null
          executed_at: string
          executed_by: string | null
          id: string
          name: string
          statements_count: number
          success: boolean
        }
        Insert: {
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          name: string
          statements_count?: number
          success?: boolean
        }
        Update: {
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          name?: string
          statements_count?: number
          success?: boolean
        }
        Relationships: []
      }
      periods: {
        Row: {
          created_at: string
          data: Json
          end_date: string
          id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          end_date: string
          id?: string
          start_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          end_date?: string
          id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rent_payments: {
        Row: {
          amount_due: number
          amount_paid: number
          apartment: string
          created_at: string
          id: string
          month: string
          notes: string
          paid: boolean
          paid_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          apartment: string
          created_at?: string
          id?: string
          month: string
          notes?: string
          paid?: boolean
          paid_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          apartment?: string
          created_at?: string
          id?: string
          month?: string
          notes?: string
          paid?: boolean
          paid_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          name_a: string
          name_b: string
          phone_a: string
          phone_b: string
          updated_at: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          name_a?: string
          name_b?: string
          phone_a?: string
          phone_b?: string
          updated_at?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          name_a?: string
          name_b?: string
          phone_a?: string
          phone_b?: string
          updated_at?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      am_i_migration_admin: { Args: never; Returns: boolean }
      can_access: { Args: { _owner: string }; Returns: boolean }
      execute_admin_migration: {
        Args: { p_name: string; p_statements: string[] }
        Returns: Json
      }
      get_migration_history: {
        Args: never
        Returns: {
          error: string
          executed_at: string
          id: string
          name: string
          statements_count: number
          success: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
