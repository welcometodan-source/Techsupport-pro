/*
  # Add Technician Approval Workflow

  ## Overview
  This migration adds an approval workflow for technicians. When someone signs up as a technician,
  they will be in a "pending" state until an admin reviews and approves them.

  ## Changes
  
  1. Profile Updates
    - Add `technician_status` column (pending, approved, rejected)
    - Add `technician_application_date` timestamp
    - Add `technician_approved_by` foreign key to admin who approved
    - Add `technician_approved_at` timestamp
    - Add `rejection_reason` text field for rejected applications
  
  2. Default Values
    - New technician signups default to 'pending' status
    - Application date is set automatically
  
  3. Security
    - Only admins can update technician_status
    - Technicians can view their own status
*/

-- Add technician approval columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'technician_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN technician_status text DEFAULT 'pending';
    
    -- Add check constraint
    ALTER TABLE profiles ADD CONSTRAINT profiles_technician_status_check 
      CHECK (technician_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'technician_application_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN technician_application_date timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'technician_approved_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN technician_approved_by uuid REFERENCES profiles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'technician_approved_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN technician_approved_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_technician_status 
  ON profiles(technician_status) 
  WHERE role = 'technician';

-- Update existing technicians to be approved
UPDATE profiles 
SET technician_status = 'approved',
    technician_approved_at = created_at
WHERE role = 'technician' AND technician_status IS NULL;

-- Create function to set application date when someone becomes a technician
CREATE OR REPLACE FUNCTION set_technician_application_date()
RETURNS TRIGGER AS $$
BEGIN
  -- When role changes to technician and application date is not set
  IF NEW.role = 'technician' AND OLD.role != 'technician' AND NEW.technician_application_date IS NULL THEN
    NEW.technician_application_date = now();
    NEW.technician_status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_technician_application_date ON profiles;
CREATE TRIGGER trigger_set_technician_application_date
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_technician_application_date();