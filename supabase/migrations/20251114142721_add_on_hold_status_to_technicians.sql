/*
  # Add "on hold" status for technician applications

  ## Overview
  This migration updates the technician approval workflow to support an "on hold" status,
  allowing admins to temporarily pause applications that need additional review.

  ## Changes
  
  1. Status Updates
    - Update check constraint to include 'on_hold' status
    - Valid statuses: pending, approved, on_hold, rejected
  
  2. Additional Fields
    - Add `on_hold_reason` text field for explaining why application is on hold
    - Add `on_hold_at` timestamp for tracking when status changed to on hold
    - Add `on_hold_by` foreign key to track which admin put it on hold
*/

-- Drop existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_technician_status_check;

-- Add updated constraint with on_hold status
ALTER TABLE profiles ADD CONSTRAINT profiles_technician_status_check 
  CHECK (technician_status IN ('pending', 'approved', 'on_hold', 'rejected'));

-- Add on_hold related columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'on_hold_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN on_hold_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'on_hold_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN on_hold_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'on_hold_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN on_hold_by uuid REFERENCES profiles(id);
  END IF;
END $$;