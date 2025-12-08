/*
  # Add Email Column to Profiles Table

  1. Changes
    - Add `email` column to profiles table
    - Create trigger to automatically populate email from auth.users
    - Backfill existing profiles with their email addresses

  2. Security
    - Email is populated automatically from auth system
    - Users cannot directly modify this field
*/

-- Add email column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- Create or replace function to sync email from auth.users
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Get email from auth.users and update profile
  UPDATE profiles
  SET email = (
    SELECT email FROM auth.users WHERE id = NEW.id
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync email on profile insert
DROP TRIGGER IF EXISTS sync_profile_email_on_insert ON profiles;
CREATE TRIGGER sync_profile_email_on_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_email();

-- Backfill existing profiles with emails from auth.users
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;