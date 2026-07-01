export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      characters: {
        Row: {
          age: string | null;
          appearance: string | null;
          approved: boolean;
          conflict: string | null;
          created_at: string;
          id: string;
          name: string;
          objective: string | null;
          personality: string | null;
          project_id: string;
          reference_url: string | null;
          role: string | null;
          sort_order: number;
          updated_at: string;
          user_id: string;
          visual_lock: Json;
        };
        Insert: {
          age?: string | null;
          appearance?: string | null;
          approved?: boolean;
          conflict?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          objective?: string | null;
          personality?: string | null;
          project_id: string;
          reference_url?: string | null;
          role?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
          visual_lock?: Json;
        };
        Update: {
          age?: string | null;
          appearance?: string | null;
          approved?: boolean;
          conflict?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          objective?: string | null;
          personality?: string | null;
          project_id?: string;
          reference_url?: string | null;
          role?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
          visual_lock?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_bibles: {
        Row: {
          content: Json;
          created_at: string;
          generations_count: number;
          model: string;
          project_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: Json;
          created_at?: string;
          generations_count?: number;
          model: string;
          project_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          generations_count?: number;
          model?: string;
          project_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_bibles_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          age_rating: string | null;
          archived: boolean;
          color_mode: Database["public"]["Enums"]["color_mode"];
          cover_url: string | null;
          created_at: string;
          creation_mode: Database["public"]["Enums"]["creation_mode"];
          current_step: string | null;
          description: string | null;
          dialogue_language: string;
          genre: string | null;
          id: string;
          initial_idea: string | null;
          page_format: string;
          reading_direction: Database["public"]["Enums"]["reading_direction"];
          slug: string | null;
          source_language: string;
          status: Database["public"]["Enums"]["project_status"];
          style_preset: string | null;
          title: string;
          tone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          age_rating?: string | null;
          archived?: boolean;
          color_mode?: Database["public"]["Enums"]["color_mode"];
          cover_url?: string | null;
          created_at?: string;
          creation_mode?: Database["public"]["Enums"]["creation_mode"];
          current_step?: string | null;
          description?: string | null;
          dialogue_language?: string;
          genre?: string | null;
          id?: string;
          initial_idea?: string | null;
          page_format?: string;
          reading_direction?: Database["public"]["Enums"]["reading_direction"];
          slug?: string | null;
          source_language?: string;
          status?: Database["public"]["Enums"]["project_status"];
          style_preset?: string | null;
          title: string;
          tone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          age_rating?: string | null;
          archived?: boolean;
          color_mode?: Database["public"]["Enums"]["color_mode"];
          cover_url?: string | null;
          created_at?: string;
          creation_mode?: Database["public"]["Enums"]["creation_mode"];
          current_step?: string | null;
          description?: string | null;
          dialogue_language?: string;
          genre?: string | null;
          id?: string;
          initial_idea?: string | null;
          page_format?: string;
          reading_direction?: Database["public"]["Enums"]["reading_direction"];
          slug?: string | null;
          source_language?: string;
          status?: Database["public"]["Enums"]["project_status"];
          style_preset?: string | null;
          title?: string;
          tone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      color_mode: "bw_traditional" | "grayscale" | "color" | "color_limited";
      creation_mode: "idea" | "pasted" | "upload" | "continuation";
      project_status:
        | "draft"
        | "analyzing_story"
        | "awaiting_approval"
        | "creating_characters"
        | "creating_storyboard"
        | "generating_images"
        | "reviewing"
        | "ready_to_export"
        | "exported"
        | "error";
      reading_direction: "rtl" | "ltr";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      color_mode: ["bw_traditional", "grayscale", "color", "color_limited"],
      creation_mode: ["idea", "pasted", "upload", "continuation"],
      project_status: [
        "draft",
        "analyzing_story",
        "awaiting_approval",
        "creating_characters",
        "creating_storyboard",
        "generating_images",
        "reviewing",
        "ready_to_export",
        "exported",
        "error",
      ],
      reading_direction: ["rtl", "ltr"],
    },
  },
} as const;
