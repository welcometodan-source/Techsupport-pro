/*
  # Add Admin UPDATE Policy for Customer Vehicle Folders

  1. Security Changes
    - Add policy to allow admins to update customer vehicle folders
    - Enables admins to update folder status when confirming payments
    - Policy checks that user is admin before allowing updates

  2. Notes
    - Required for payment confirmation to update vehicle folder status
    - When payment is confirmed, vehicle folders must change to 'active'
    - Maintains security by checking admin role
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_vehicle_folders' 
    AND policyname = 'Admins can update all vehicle folders'
  ) THEN
    CREATE POLICY "Admins can update all vehicle folders"
      ON customer_vehicle_folders
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
  END IF;
END $$;
