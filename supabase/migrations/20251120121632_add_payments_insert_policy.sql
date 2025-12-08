/*
  # Add INSERT policy for payments table

  1. Changes
    - Add INSERT policy to allow admins to create payment records
    - This fixes the issue where payment confirmations weren't creating records in the payments table

  2. Security
    - Only admins can insert payment records
    - Maintains data integrity by restricting payment creation to authorized personnel
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can create payments" ON payments;

-- Allow admins to insert payment records
CREATE POLICY "Admins can create payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
