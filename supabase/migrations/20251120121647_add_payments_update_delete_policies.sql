/*
  # Add UPDATE and DELETE policies for payments table

  1. Changes
    - Add UPDATE policy to allow admins to modify payment records
    - Add DELETE policy to allow admins to remove payment records if needed

  2. Security
    - Only admins can update or delete payment records
    - Maintains data integrity and audit trail
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can update payments" ON payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON payments;

-- Allow admins to update payment records
CREATE POLICY "Admins can update payments"
  ON payments
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

-- Allow admins to delete payment records
CREATE POLICY "Admins can delete payments"
  ON payments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
