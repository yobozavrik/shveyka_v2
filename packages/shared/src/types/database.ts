export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable = {
  Row: Record<string, Json | null>;
  Insert: Record<string, Json | null>;
  Update: Record<string, Json | null>;
};

type GenericView = {
  Row: Record<string, Json | null>;
};

type GenericFn = {
  Args: Record<string, Json | null>;
  Returns: Json | null;
};

export interface Database {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericView>;
    Functions: Record<string, GenericFn>;
    Enums: Record<string, string>;
  };
  shveyka: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericView>;
    Functions: Record<string, GenericFn>;
    Enums: Record<string, string>;
  };
}
