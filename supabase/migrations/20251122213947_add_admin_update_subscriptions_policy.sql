/*
  # Add Admin UPDATE Policy for Customer Subscriptions

  1. Security Changes
    - Add policy to allow admins to update customer subscriptions
    - Enables admins to confirm payments and manage subscription status
    - Policy checks that user is admin before allowing updates

  2. Notes
    - This is critical for payment confirmation workflow
    - Admins need ability to update payment_confirmed, status, etc.
    - Maintains security by checking admin role
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_subscriptions' 
    AND policyname = 'Admins can update all subscriptions'
  ) THEN
    CREATE POLICY "Admins can update all subscriptions"
      ON customer_subscriptions
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
