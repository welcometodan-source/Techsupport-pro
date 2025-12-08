/*
  # Add Complete User Deletion Function

  1. Purpose
    - Creates a secure admin function to completely delete a user from the system
    - Deletes user from both profiles and auth.users tables
    - All related data is automatically deleted via CASCADE constraints

  2. Function Details
    - `delete_user_completely(user_id uuid)` - Admin-only function
    - First deletes from profiles (triggers CASCADE deletion of all related records)
    - Then deletes from auth.users (requires admin privileges)
    - Returns boolean indicating success

  3. Security
    - Only admins can execute this function
    - Uses security definer to allow deletion from auth.users
    - Validates that the caller is an admin before proceeding

  4. Tables Affected (via CASCADE)
    - profiles (direct)
    - customer_subscriptions
    - customer_vehicle_folders
    - scheduled_inspections
    - subscription_visits
    - support_tickets
    - messages
    - payments
    - appointments
    - ratings
    - documents
    - customer_preferences
    - invoices
    - And all other related records
*/

-- Create function to completely delete a user (profiles + auth.users)
CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Check if the caller is an admin
  SELECT role INTO caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete from profiles first (this cascades to all related tables)
  DELETE FROM profiles WHERE id = target_user_id;

  -- Delete from auth.users (requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users (function checks for admin role internally)
GRANT EXECUTE ON FUNCTION delete_user_completely(uuid) TO authenticated;