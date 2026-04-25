export type Difficulty = 'easy' | 'hard';
export type RunResult = 'win' | 'lose';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type RunRow = {
  id: string;
  user_id: string;
  map_id: string;
  difficulty: Difficulty;
  result: RunResult;
  rounds_completed: number;
  total_rounds: number;
  lives_remaining: number;
  duration_seconds: number;
  seed: number;
  input_log: unknown | null;
  created_at: string;
};

export type RunInsert = Omit<RunRow, 'id' | 'created_at'>;

export type LeaderboardEntryRow = {
  user_id: string;
  map_id: string;
  difficulty: Difficulty;
  rounds_completed: number;
  lives_remaining: number;
  duration_seconds: number;
  run_id: string;
  updated_at: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' };
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      runs: {
        Row: RunRow;
        Insert: RunInsert;
        Update: Partial<RunRow>;
        Relationships: [];
      };
      leaderboard_entries: {
        Row: LeaderboardEntryRow;
        Insert: LeaderboardEntryRow;
        Update: Partial<LeaderboardEntryRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
