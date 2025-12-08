/*
  # Add Admin Profile Update Policy

  ## Overview
  This migration adds RLS policies to allow admins to update any user's profile.
  Previously, only users could update their own profiles, which prevented admins
  from promoting customers to technicians or managing user roles.

  ## Changes
  
  1. Security Policies
    - Add policy allowing admins to update any profile
    - This enables the "Make Tech" button and other admin management features
  
  ## Notes
  - Admins are identified by checking if their profile role is 'admin'
  - The existing "Users can update own profile" policy remains in place
  - Both policies work together to allow users to update themselves and admins to update anyone
*/

-- Create policy to allow admins to update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles
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
