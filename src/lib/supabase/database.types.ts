export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { name?: string; slug?: string; updated_at?: string };
        Relationships: Relationship[];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["organization_role"];
          created_at: string;
          updated_at: string;
          removed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["organization_role"];
          created_at?: string;
          updated_at?: string;
          removed_at?: string | null;
        };
        Update: {
          role?: Database["public"]["Enums"]["organization_role"];
          updated_at?: string;
          removed_at?: string | null;
        };
        Relationships: Relationship[];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: Database["public"]["Enums"]["organization_role"];
          token_hash: string;
          created_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: Database["public"]["Enums"]["organization_role"];
          token_hash: string;
          created_by: string;
          expires_at: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
        };
        Update: { accepted_at?: string | null; accepted_by?: string | null };
        Relationships: Relationship[];
      };
      projects: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          key: string;
          description: string;
          status: Database["public"]["Enums"]["project_status"];
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          key: string;
          description?: string;
          status?: Database["public"]["Enums"]["project_status"];
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          key?: string;
          description?: string;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Relationships: Relationship[];
      };
      tasks: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string;
          title: string;
          description: string;
          status: Database["public"]["Enums"]["task_status"];
          priority: Database["public"]["Enums"]["task_priority"];
          assignee_id: string | null;
          reporter_id: string;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id: string;
          title: string;
          description?: string;
          status?: Database["public"]["Enums"]["task_status"];
          priority?: Database["public"]["Enums"]["task_priority"];
          assignee_id?: string | null;
          reporter_id: string;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          status?: Database["public"]["Enums"]["task_status"];
          priority?: Database["public"]["Enums"]["task_priority"];
          assignee_id?: string | null;
          due_date?: string | null;
          updated_at?: string;
        };
        Relationships: Relationship[];
      };
      comments: {
        Row: {
          id: string;
          organization_id: string;
          task_id: string;
          author_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          task_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { body?: string; updated_at?: string };
        Relationships: Relationship[];
      };
      attachments: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string;
          task_id: string | null;
          uploaded_by: string;
          storage_path: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          content_sha256: string;
          storage_object_id: string | null;
          upload_status: Database["public"]["Enums"]["attachment_status"];
          deletion_started_at: string | null;
          cleanup_claimed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id: string;
          task_id?: string | null;
          uploaded_by: string;
          storage_path: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          content_sha256: string;
          storage_object_id?: string | null;
          upload_status?: Database["public"]["Enums"]["attachment_status"];
          deletion_started_at?: string | null;
          cleanup_claimed_at?: string | null;
          created_at?: string;
        };
        Update: {
          upload_status?: Database["public"]["Enums"]["attachment_status"];
          storage_object_id?: string | null;
          deletion_started_at?: string | null;
          cleanup_claimed_at?: string | null;
        };
        Relationships: Relationship[];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: Relationship[];
      };
      rate_limit_windows: {
        Row: {
          key_hash: string;
          operation: string;
          window_started_at: string;
          request_count: number;
          expires_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: Relationship[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: {
        Args: { organization_name: string; organization_slug: string };
        Returns: Json;
      };
      accept_organization_invitation: {
        Args: {
          invitation_token: string;
          verified_email: string;
          server_proof: string;
        };
        Returns: Json;
      };
      consume_export_attempt: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      consume_upload_attempt: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      create_comment: {
        Args: {
          target_organization_id: string;
          target_task_id: string;
          comment_body: string;
        };
        Returns: Json;
      };
      create_organization_invitation: {
        Args: {
          target_organization_id: string;
          invitation_email: string;
          invitation_role: string;
        };
        Returns: Json;
      };
      preview_organization_invitation: {
        Args: {
          invitation_token: string;
          verified_email: string;
          server_proof: string;
        };
        Returns: Json;
      };
      change_organization_member_role: {
        Args: {
          target_organization_id: string;
          target_membership_id: string;
          target_role: string;
        };
        Returns: Json;
      };
      remove_organization_member: {
        Args: {
          target_organization_id: string;
          target_membership_id: string;
        };
        Returns: Json;
      };
      revoke_organization_invitation: {
        Args: {
          target_organization_id: string;
          target_invitation_id: string;
        };
        Returns: Json;
      };
      reserve_attachment: {
        Args: {
          attachment_id: string;
          target_organization_id: string;
          target_project_id: string;
          target_task_id: string;
          object_path: string;
          download_name: string;
          declared_mime_type: string;
          declared_size_bytes: number;
          declared_content_sha256: string;
          server_proof: string;
        };
        Returns: Json;
      };
      finalize_attachment: {
        Args: {
          attachment_id: string;
          target_storage_object_id: string;
          declared_content_sha256: string;
          server_proof: string;
        };
        Returns: Json;
      };
      seal_attachment_upload: {
        Args: {
          attachment_id: string;
          target_storage_object_id: string;
          server_proof: string;
        };
        Returns: Json;
      };
      cancel_attachment_reservation: {
        Args: { attachment_id: string; server_proof: string };
        Returns: Json;
      };
      begin_attachment_deletion: {
        Args: { attachment_id: string };
        Returns: Json;
      };
      reconcile_attachment_deletion: {
        Args: { attachment_id: string };
        Returns: Json;
      };
      claim_attachment_cleanup_batch: {
        Args: Record<PropertyKey, never>;
        Returns: {
          attachment_id: string;
          storage_path: string;
          cleanup_mode: string;
        }[];
      };
      finalize_attachment_cleanup: {
        Args: { target_attachment_id: string };
        Returns: Json;
      };
      current_user_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_organization_member: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      organization_role_for: {
        Args: { target_organization_id: string };
        Returns: Database["public"]["Enums"]["organization_role"] | null;
      };
      has_organization_role: {
        Args: {
          target_organization_id: string;
          allowed_roles: Database["public"]["Enums"]["organization_role"][];
        };
        Returns: boolean;
      };
    };
    Enums: {
      organization_role: "member" | "admin" | "owner";
      project_status:
        "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
      task_status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
      task_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      attachment_status:
        "pending" | "verifying" | "ready" | "deleting" | "discarding";
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];
export type TableInsert<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Insert"];
export type TableUpdate<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Update"];
