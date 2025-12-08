/*
  # Fix Profiles RLS Recursion - Better Approach

  ## Problem
  Policies that query the same table cause infinite recursion.

  ## Solution
  1. Drop all complex policies
  2. Use simpler policies that don't query profiles table recursively
  3. For technician/admin access, we'll use a different approach

  ## Changes
  - Drop problematic policies
  - Recreate with simpler logic
  - Allow public read access for authenticated users (typical for profile info)
*/

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Technicians can view customer profiles" ON profiles;
DROP POLICY IF EXISTS "Technicians and admins can view all profiles" ON profiles;

-- Drop the function we created
DROP FUNCTION IF EXISTS public.is_technician_or_admin();

-- Create simple, non-recursive policies

-- Allow users to view all profiles (needed for technician/customer interaction)
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update only their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to delete only their own profile (if needed)
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
