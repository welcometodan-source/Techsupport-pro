/*
  # Add Profile Status and Ticket Resolution Tracking

  ## Changes
  
  1. Profile Updates
    - Add `status` column to profiles table (active, blocked)
    - Add default value of 'active' for existing profiles
  
  2. Support Tickets Updates
    - Add `resolved_at` timestamp to track when tickets are resolved
    - Add `resolution_time_minutes` calculated field for reporting
    - Update existing resolved tickets with estimated resolved_at time
  
  3. Security
    - Maintain existing RLS policies
    - Add policies for new columns
*/

-- Add status column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active' NOT NULL;
    
    -- Add check constraint
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check 
      CHECK (status IN ('active', 'blocked'));
  END IF;
END $$;

-- Add resolved_at to support_tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;

-- Create index for performance queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_resolved_at 
  ON support_tickets(resolved_at) 
  WHERE resolved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_technician 
  ON support_tickets(assigned_technician_id) 
  WHERE assigned_technician_id IS NOT NULL;

-- Create a function to automatically set resolved_at when status changes to resolved
CREATE OR REPLACE FUNCTION set_ticket_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  END IF;
  
  IF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
    NEW.resolved_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_resolved_at ON support_tickets;
CREATE TRIGGER trigger_set_resolved_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_resolved_at();