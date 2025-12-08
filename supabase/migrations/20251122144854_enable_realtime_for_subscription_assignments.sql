/*
  # Enable Realtime for Subscription Assignments

  ## Overview
  This migration enables real-time updates for the subscription_assignments table
  so that technicians receive instant notifications when they are assigned to a subscription.

  ## Changes
  - Enable realtime for subscription_assignments table
  - This allows technicians to see new assignments immediately without refreshing
*/

-- Enable realtime for subscription_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_assignments;
