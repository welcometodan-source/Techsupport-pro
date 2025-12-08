/*
  # Allow Customers to Submit Subscription Payment Details

  1. Security Changes
    - Add an UPDATE policy on `customer_subscriptions` so that authenticated users
      can update their OWN subscription rows.
    - This is required so customers can set:
        - payment_method
        - payment_reference
        - last_payment_date
      when submitting CarDoc/AutoDoc subscription payments.

  2. Notes
    - Admins still control activation via `payment_confirmed` and `status`.
    - This policy only allows users to update rows where `user_id = auth.uid()`.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'customer_subscriptions'
      AND policyname = 'Users can update own subscription payments'
  ) THEN
    CREATE POLICY "Users can update own subscription payments"
      ON customer_subscriptions
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;



