/*
  # Add Payment Confirmation Workflow

  ## Overview
  This migration adds payment tracking and confirmation fields to support the workflow where:
  1. Customer makes payment after receiving cost estimate
  2. Admin confirms payment receipt
  3. Only after payment confirmation, technician can start work (chat/call enabled)

  ## Changes to support_tickets table
  
  Add payment tracking fields:
    - `payment_made` (boolean) - Customer has submitted payment
    - `payment_made_at` (timestamptz) - When customer made payment
    - `payment_amount` (numeric) - Amount paid by customer
    - `payment_reference` (text) - Payment reference/transaction ID
    - `payment_confirmed` (boolean) - Admin confirmed payment receipt
    - `payment_confirmed_at` (timestamptz) - When admin confirmed payment
    - `payment_confirmed_by` (uuid) - Which admin confirmed payment
    - `work_authorized` (boolean) - Work can begin (auto-set when payment confirmed)
  
  ## Workflow States
  1. Ticket created → Technician provides estimate → Status: 'awaiting_payment'
  2. Customer pays → payment_made = true → Admin notified
  3. Admin confirms → payment_confirmed = true, work_authorized = true → Status: 'in_progress'
  4. Technician can now chat/call and work on ticket
  
  ## Security
  - Customers can update payment_made fields on their own tickets
  - Admins can update payment_confirmed fields
  - work_authorized is set automatically when admin confirms payment
*/

-- Add payment tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'payment_made'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN payment_made boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'payment_made_at'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN payment_made_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'payment_amount'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN payment_amount numeric(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN payment_reference text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'payment_confirmed'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN payment_confirmed boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'payment_confirmed_at'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN payment_confirmed_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'payment_confirmed_by'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN payment_confirmed_by uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'work_authorized'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN work_authorized boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_payment_made ON support_tickets(payment_made);
CREATE INDEX IF NOT EXISTS idx_support_tickets_payment_confirmed ON support_tickets(payment_confirmed);
CREATE INDEX IF NOT EXISTS idx_support_tickets_work_authorized ON support_tickets(work_authorized);

-- Create RLS policy to allow customers to update payment_made fields
CREATE POLICY "Customers can update payment status on own tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'customer'
    )
  )
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'customer'
    )
  );

-- Create function to automatically authorize work when payment is confirmed
CREATE OR REPLACE FUNCTION authorize_work_on_payment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment_confirmed changed to true, set work_authorized to true
  IF NEW.payment_confirmed = true AND (OLD.payment_confirmed IS NULL OR OLD.payment_confirmed = false) THEN
    NEW.work_authorized = true;
    -- Update status to in_progress if it was awaiting_payment
    IF NEW.status = 'awaiting_payment' THEN
      NEW.status = 'in_progress';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic work authorization
DROP TRIGGER IF EXISTS trigger_authorize_work ON support_tickets;
CREATE TRIGGER trigger_authorize_work
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION authorize_work_on_payment_confirmation();
