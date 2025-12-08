/*
  # Add Document Management System

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, foreign key to profiles)
      - `document_type` (text) - registration, insurance, warranty, invoice, diagnostic, other
      - `title` (text)
      - `description` (text, optional)
      - `file_name` (text)
      - `file_type` (text)
      - `file_size` (bigint)
      - `storage_path` (text)
      - `file_url` (text)
      - `related_ticket_id` (uuid, optional)
      - `related_vehicle_vin` (text, optional)
      - `expiry_date` (date, optional)
      - `is_archived` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `document_shares`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `shared_with_id` (uuid, foreign key to profiles)
      - `shared_by_id` (uuid, foreign key to profiles)
      - `can_edit` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can view and manage their own documents
    - Users can view documents shared with them
    - Technicians can view customer documents for their tickets
*/

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('registration', 'insurance', 'warranty', 'invoice', 'diagnostic', 'repair_report', 'photo', 'video', 'other')),
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  file_url text NOT NULL,
  related_ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  related_vehicle_vin text,
  expiry_date date,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document shares table
CREATE TABLE IF NOT EXISTS document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  shared_with_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_by_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id, shared_with_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_ticket ON documents(related_ticket_id);
CREATE INDEX IF NOT EXISTS idx_documents_vin ON documents(related_vehicle_vin);
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_user ON document_shares(shared_with_id);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
      AND document_shares.shared_with_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = documents.related_ticket_id
      AND support_tickets.assigned_technician_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create their own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
      AND document_shares.shared_with_id = auth.uid()
      AND document_shares.can_edit = true
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
      AND document_shares.shared_with_id = auth.uid()
      AND document_shares.can_edit = true
    )
  );

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Document shares policies
CREATE POLICY "Users can view shares for their documents"
  ON document_shares FOR SELECT
  TO authenticated
  USING (
    shared_with_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
      AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Document owners can share their documents"
  ON document_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
      AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Document owners can delete shares"
  ON document_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
      AND documents.owner_id = auth.uid()
    )
  );