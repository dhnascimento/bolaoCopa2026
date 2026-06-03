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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      fixtures: {
        Row: {
          api_fixture_id: number
          away_score: number | null
          away_team_id: number | null
          finished_at: string | null
          home_score: number | null
          home_team_id: number | null
          id: number
          kickoff_at: string
          lock_at: string
          odds_away: number | null
          odds_draw: number | null
          odds_fetched_at: string | null
          odds_home: number | null
          regulation_away: number | null
          regulation_home: number | null
          reminder_sent_at: string | null
          stage: string
          status: string
        }
        Insert: {
          api_fixture_id: number
          away_score?: number | null
          away_team_id?: number | null
          finished_at?: string | null
          home_score?: number | null
          home_team_id?: number | null
          id?: never
          kickoff_at: string
          lock_at: string
          odds_away?: number | null
          odds_draw?: number | null
          odds_fetched_at?: string | null
          odds_home?: number | null
          regulation_away?: number | null
          regulation_home?: number | null
          reminder_sent_at?: string | null
          stage: string
          status?: string
        }
        Update: {
          api_fixture_id?: number
          away_score?: number | null
          away_team_id?: number | null
          finished_at?: string | null
          home_score?: number | null
          home_team_id?: number | null
          id?: never
          kickoff_at?: string
          lock_at?: string
          odds_away?: number | null
          odds_draw?: number | null
          odds_fetched_at?: string | null
          odds_home?: number | null
          regulation_away?: number | null
          regulation_home?: number | null
          reminder_sent_at?: string | null
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_bets: {
        Row: {
          created_at: string
          fixture_id: number
          id: number
          points_awarded: number
          predicted_away: number
          predicted_home: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fixture_id: number
          id?: never
          points_awarded?: number
          predicted_away: number
          predicted_home: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fixture_id?: number
          id?: never
          points_awarded?: number
          predicted_away?: number
          predicted_home?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_bets_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outright_bets: {
        Row: {
          bet_type: string
          created_at: string
          id: number
          points_awarded: number
          predicted_player_id: number | null
          predicted_team_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bet_type: string
          created_at?: string
          id?: never
          points_awarded?: number
          predicted_player_id?: number | null
          predicted_team_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bet_type?: string
          created_at?: string
          id?: never
          points_awarded?: number
          predicted_player_id?: number | null
          predicted_team_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outright_bets_predicted_player_id_fkey"
            columns: ["predicted_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outright_bets_predicted_team_id_fkey"
            columns: ["predicted_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outright_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "outright_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          api_player_id: number
          id: number
          name: string
          team_id: number | null
        }
        Insert: {
          api_player_id: number
          id?: never
          name: string
          team_id?: number | null
        }
        Update: {
          api_player_id?: number
          id?: never
          name?: string
          team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          locale: string
          payment_admin_status: string
          payment_confirmed_by: string | null
          payment_self_confirmed_at: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_admin?: boolean
          locale?: string
          payment_admin_status?: string
          payment_confirmed_by?: string | null
          payment_self_confirmed_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          locale?: string
          payment_admin_status?: string
          payment_confirmed_by?: string | null
          payment_self_confirmed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          currency: string
          entry_fee: number
          id: number
          pct_first: number
          pct_second: number
          pct_third: number
          points_correct_champion: number
          points_correct_result: number
          points_correct_top_scorer: number
          points_exact_score_bonus: number
          registration_locked_at: string | null
          updated_at: string
        }
        Insert: {
          currency?: string
          entry_fee?: number
          id?: number
          pct_first?: number
          pct_second?: number
          pct_third?: number
          points_correct_champion?: number
          points_correct_result?: number
          points_correct_top_scorer?: number
          points_exact_score_bonus?: number
          registration_locked_at?: string | null
          updated_at?: string
        }
        Update: {
          currency?: string
          entry_fee?: number
          id?: number
          pct_first?: number
          pct_second?: number
          pct_third?: number
          points_correct_champion?: number
          points_correct_result?: number
          points_correct_top_scorer?: number
          points_exact_score_bonus?: number
          registration_locked_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          api_team_id: number
          flag_url: string | null
          id: number
          name: string
        }
        Insert: {
          api_team_id: number
          flag_url?: string | null
          id?: never
          name: string
        }
        Update: {
          api_team_id?: number
          flag_url?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          correct_results: number | null
          display_name: string | null
          exact_hits: number | null
          points: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      score_match_bets: { Args: never; Returns: number }
      place_match_bet: {
        Args: {
          p_fixture_id: number
          p_predicted_home: number
          p_predicted_away: number
        }
        Returns: {
          id: number
          user_id: string
          fixture_id: number
          predicted_home: number
          predicted_away: number
          points_awarded: number
          created_at: string
          updated_at: string
        }
      }
      registration_locked: { Args: never; Returns: boolean }
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
