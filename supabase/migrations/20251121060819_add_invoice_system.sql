/*
  # Add Invoice System

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique) - Auto-generated invoice number
      - `customer_id` (uuid) - References profiles table
      - `ticket_id` (uuid) - References support_tickets table
      - `payment_type` (text) - 'initial', 'final', or 'full'
      - `amount` (numeric) - Invoice amount
      - `currency` (text) - Currency code (default: USD)
      - `issue_date` (timestamptz) - When invoice was generated
      - `due_date` (timestamptz) - Payment due date
      - `payment_date` (timestamptz) - When payment was received
      - `status` (text) - 'paid', 'pending', 'overdue'
      - `payment_reference` (text) - Payment transaction reference
      - `vehicle_info` (jsonb) - Vehicle details
      - `service_details` (text) - Description of service
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `invoices` table
    - Add policies for customers to view their own invoices
    - Add policies for admins to manage all invoices
    - Add policies for technicians to view invoices for their tickets

  3. Functions
    - Function to auto-generate unique invoice numbers
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('initial', 'final', 'full')),
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  issue_date timestamptz DEFAULT now(),
  due_date timestamptz,
  payment_date timestamptz,
  status text DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue')),
  payment_reference text,
  vehicle_info jsonb,
  service_details text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  new_invoice_number text;
  year_month text;
  sequence_num integer;
BEGIN
  -- Format: INV-YYYYMM-XXXX (e.g., INV-202511-0001)
  year_month := to_char(now(), 'YYYYMM');
  
  -- Get the next sequence number for this month
  SELECT COALESCE(MAX(
    CAST(substring(invoice_number from '\d{4}$') AS integer)
  ), 0) + 1
  INTO sequence_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_month || '-%';
  
  -- Generate the invoice number
  new_invoice_number := 'INV-' || year_month || '-' || lpad(sequence_num::text, 4, '0');
  
  RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view their own invoices
CREATE POLICY "Customers can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'customer'
      AND invoices.customer_id = profiles.id
    )
  );

-- Policy: Admins can view all invoices
CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can insert invoices
CREATE POLICY "Admins can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update invoices
CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Technicians can view invoices for their assigned tickets
CREATE POLICY "Technicians can view assigned ticket invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = invoices.ticket_id
      AND support_tickets.assigned_technician_id = auth.uid()
    )
  );

-- Create index for faster invoice number generation
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number 
  ON invoices(invoice_number);

-- Create index for customer queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id 
  ON invoices(customer_id);

-- Create index for ticket queries
CREATE INDEX IF NOT EXISTS idx_invoices_ticket_id 
  ON invoices(ticket_id);
