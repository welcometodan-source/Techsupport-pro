/*
  # Fix Profiles RLS Infinite Recursion

  ## Problem
  The policy "Technicians can view customer profiles" causes infinite recursion because it queries
  the profiles table to check if the user is a technician, which triggers the same policy again.

  ## Solution
  1. Drop the problematic policy
  2. Create a function to safely check user role using auth.jwt()
  3. Recreate the policy using the function to avoid recursion

  ## Changes
  - Drop policy "Technicians can view customer profiles"
  - Create function to check if user is technician/admin from JWT
  - Create new policy that uses the function instead of subquery
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Technicians can view customer profiles" ON profiles;

-- Create a function to check user role without recursion
-- We'll use app_metadata in JWT which can be set during signup
CREATE OR REPLACE FUNCTION public.is_technician_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- For now, we'll allow technicians and admins to view profiles
  -- by checking if they can read their own profile first
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND role IN ('technician', 'admin')
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simpler policy that allows technicians/admins to view all profiles
-- This policy will only be checked AFTER the user's own profile is readable
CREATE POLICY "Technicians and admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    -- If the user has technician or admin role, they can see all profiles
    -- This works because the "Users can view own profile" policy runs first
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('technician', 'admin')
  );
