/*
  # Add Technician Access to Customer Subscriptions

  ## Overview
  This migration adds RLS policy to allow technicians to view customer subscriptions
  they are assigned to via subscription_assignments table.

  ## Changes
  - Add SELECT policy for technicians to view subscriptions they're assigned to
  
  ## Security
  - Policy checks that technician has an active assignment for the subscription
  - Maintains data security by only exposing assigned subscriptions
*/

-- Allow technicians to view subscriptions they are assigned to
CREATE POLICY "Technicians can view assigned subscriptions"
  ON customer_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM subscription_assignments
      WHERE subscription_assignments.subscription_id = customer_subscriptions.id
        AND subscription_assignments.technician_id = auth.uid()
        AND subscription_assignments.status = 'active'
    )
  );
