/*
  # Add Vehicle Information and Pricing Workflow

  ## Overview
  This migration enhances the support ticket system to include detailed vehicle information,
  technician cost estimates, service type determination (on-site vs online), and partial payment support.

  ## Changes
  
  ### 1. Support Tickets - Vehicle Information
  Add detailed vehicle fields:
    - `vehicle_brand` (text) - Car manufacturer (e.g., Toyota, Ford, BMW)
    - `vehicle_model` (text) - Car model (e.g., Camry, F-150, X5)
    - `vehicle_year` (integer) - Year of manufacture
    - `job_type` (text) - Type of repair/service needed
  
  ### 2. Support Tickets - Technician Assessment
  Add technician evaluation fields:
    - `service_type` (text) - 'on_site', 'online', 'pending' (technician determines this)
    - `estimated_cost` (numeric) - Cost estimate provided by technician
    - `technician_notes` (text) - Technician's assessment notes
    - `cost_assessed_at` (timestamptz) - When technician provided the estimate
    - `cost_assessed_by` (uuid) - Which technician assessed the cost
  
  ### 3. Support Tickets - Admin and Customer Approval
  Add pricing approval workflow fields:
    - `price_relayed_to_customer` (boolean) - Admin has informed customer of price
    - `price_relayed_at` (timestamptz) - When admin relayed the price
    - `price_relayed_by` (uuid) - Which admin relayed the price
    - `customer_approved_price` (boolean) - Customer accepted the price
    - `customer_approval_at` (timestamptz) - When customer approved
  
  ### 4. Payments - Partial Payment Support
  Add fields for handling partial payments (on-site jobs):
    - `payment_type` (text) - 'full', 'partial_initial', 'partial_final'
    - `related_payment_id` (uuid) - Links final payment to initial payment
    - `ticket_id` (uuid) - Direct link to the ticket being paid for
  
  ### 5. Update Status Values
  Add new status to support_tickets:
    - 'awaiting_assessment' - Waiting for technician to review and estimate
    - 'awaiting_payment' - Waiting for customer to pay
    - 'payment_partial' - Half paid (on-site jobs)
  
  ## Workflow
  1. Customer creates ticket with vehicle details (brand, model, year, job type)
  2. Admin assigns to technician
  3. Technician reviews and updates: service_type, estimated_cost, technician_notes
  4. Admin relays price to customer
  5. Customer approves and pays:
     - Online: Full payment required before work starts
     - On-site: 50% upfront, 50% on completion
  6. Technician completes work
  7. For on-site jobs: Final payment collected
  
  ## Security
  - Technicians can update assessment fields on assigned tickets
  - Admins can update price relay fields
  - Customers can update approval fields on their own tickets
*/

-- Add vehicle information columns to support_tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'vehicle_brand'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN vehicle_brand text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'vehicle_model'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN vehicle_model text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'vehicle_year'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN vehicle_year integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'job_type'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN job_type text;
  END IF;
END $$;

-- Add technician assessment columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN service_type text DEFAULT 'pending' CHECK (service_type IN ('on_site', 'online', 'pending'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'estimated_cost'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN estimated_cost numeric(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'technician_notes'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN technician_notes text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'cost_assessed_at'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN cost_assessed_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'cost_assessed_by'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN cost_assessed_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Add admin price relay columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'price_relayed_to_customer'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN price_relayed_to_customer boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'price_relayed_at'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN price_relayed_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'price_relayed_by'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN price_relayed_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Add customer approval columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'customer_approved_price'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN customer_approved_price boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'customer_approval_at'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN customer_approval_at timestamptz;
  END IF;
END $$;

-- Drop the existing status check constraint and recreate with new values
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
  
  -- Add new constraint with additional status values
  ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check 
    CHECK (status IN ('open', 'in_progress', 'awaiting_assessment', 'awaiting_payment', 'payment_partial', 'resolved', 'closed'));
END $$;

-- Add partial payment support columns to payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_type text DEFAULT 'full' CHECK (payment_type IN ('full', 'partial_initial', 'partial_final'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'related_payment_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN related_payment_id uuid REFERENCES payments(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'ticket_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN ticket_id uuid REFERENCES support_tickets(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_service_type ON support_tickets(service_type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_price_relay ON support_tickets(price_relayed_to_customer);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_approval ON support_tickets(customer_approved_price);
CREATE INDEX IF NOT EXISTS idx_payments_ticket_id ON payments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);

-- Update RLS policies to allow technicians to update assessment fields
CREATE POLICY "Technicians can update assessment on assigned tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = assigned_technician_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'technician'
    )
  )
  WITH CHECK (
    auth.uid() = assigned_technician_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'technician'
    )
  );

-- Allow admins to update all ticket fields
CREATE POLICY "Admins can update all tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
