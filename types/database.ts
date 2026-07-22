export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      zoho_customers: {
        Row: {
          id: string;
          zoho_customer_id: string;
          display_name: string;
          company_name: string | null;
          email: string | null;
          phone: string | null;
          billing_address: string | null;
          is_active: boolean;
          is_member: boolean;
          collected_by: string | null;
          ownership: string | null;
          customer_group: string | null;
          order_number: number | null;
          raw: Json;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zoho_customer_id: string;
          display_name: string;
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          billing_address?: string | null;
          is_active?: boolean;
          is_member?: boolean;
          collected_by?: string | null;
          ownership?: string | null;
          customer_group?: string | null;
          order_number?: number | null;
          raw?: Json;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["zoho_customers"]["Insert"]>;
        Relationships: [];
      };
      zoho_invoices: {
        Row: {
          id: string;
          zoho_invoice_id: string;
          customer_id: string | null;
          customer_name: string | null;
          invoice_number: string | null;
          status: string;
          date: string | null;
          due_date: string | null;
          total: number;
          balance: number;
          currency_code: string | null;
          item_name: string | null;
          raw: Json;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zoho_invoice_id: string;
          customer_id?: string | null;
          customer_name?: string | null;
          invoice_number?: string | null;
          status: string;
          date?: string | null;
          due_date?: string | null;
          total?: number;
          balance?: number;
          currency_code?: string | null;
          item_name?: string | null;
          raw?: Json;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["zoho_invoices"]["Insert"]>;
        Relationships: [];
      };
      zoho_expenses: {
        Row: {
          id: string;
          zoho_expense_id: string;
          vendor_name: string | null;
          expense_number: string | null;
          status: string;
          date: string | null;
          due_date: string | null;
          total: number;
          balance: number;
          currency_code: string | null;
          account_name: string | null;
          paid_through_account_name: string | null;
          description: string | null;
          raw: Json;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zoho_expense_id: string;
          vendor_name?: string | null;
          expense_number?: string | null;
          status: string;
          date?: string | null;
          due_date?: string | null;
          total?: number;
          balance?: number;
          currency_code?: string | null;
          account_name?: string | null;
          paid_through_account_name?: string | null;
          description?: string | null;
          raw?: Json;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["zoho_expenses"]["Insert"]>;
        Relationships: [];
      };
      zoho_bills: {
        Row: {
          id: string;
          zoho_bill_id: string;
          vendor_name: string | null;
          bill_number: string | null;
          status: string;
          date: string | null;
          due_date: string | null;
          total: number;
          balance: number;
          currency_code: string | null;
          account_name: string | null;
          item_name: string | null;
          raw: Json;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zoho_bill_id: string;
          vendor_name?: string | null;
          bill_number?: string | null;
          status: string;
          date?: string | null;
          due_date?: string | null;
          total?: number;
          balance?: number;
          currency_code?: string | null;
          account_name?: string | null;
          item_name?: string | null;
          raw?: Json;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["zoho_bills"]["Insert"]>;
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: string;
          provider: string;
          status: string;
          started_at: string;
          finished_at: string | null;
          records_upserted: number;
          error: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          status: string;
          started_at?: string;
          finished_at?: string | null;
          records_upserted?: number;
          error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_email: string | null;
          action: string;
          table_name: string;
          record_ids: string[];
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_email?: string | null;
          action: string;
          table_name: string;
          record_ids?: string[];
          detail?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      dashboard_monthly_revenue: {
        Row: {
          month: string | null;
          revenue: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
