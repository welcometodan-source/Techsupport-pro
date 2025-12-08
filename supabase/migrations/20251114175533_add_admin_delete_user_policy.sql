/*
  # Add Admin Delete User Policy

  1. Changes
    - Add DELETE policy to profiles table allowing admins to delete users
    - Admins can delete any user profile except their own (safety measure)
  
  2. Security
    - Only users with role='admin' can delete profiles
    - Admins cannot delete their own profile to prevent accidental lockout
*/

-- Add DELETE policy for admins
CREATE POLICY "Admins can delete other users"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND id != auth.uid()
  );
