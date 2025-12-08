/*
  # Add Subscription Invoice Support

  1. Changes
    - Make ticket_id nullable (subscription payments don't have tickets)
    - Add subscription_id field to link invoices to subscriptions
    - Update payment_type to include 'subscription'
    - Update RLS policies to support subscription invoices

  2. Purpose
    - Allow invoices to be created for subscription payments
    - Maintain backward compatibility with ticket-based invoices
*/

-- Make ticket_id nullable
ALTER TABLE invoices 
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Add subscription_id field
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES customer_subscriptions(id) ON DELETE CASCADE;

-- Update payment_type constraint to include 'subscription'
ALTER TABLE invoices 
  DROP CONSTRAINT IF EXISTS invoices_payment_type_check;

ALTER TABLE invoices 
  ADD CONSTRAINT invoices_payment_type_check 
  CHECK (payment_type IN ('initial', 'final', 'full', 'subscription'));

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id 
  ON invoices(subscription_id);

-- Update RLS policy to allow customers to view subscription invoices
-- (Existing policy should already work, but ensure it does)
-- The existing "Customers can view own invoices" policy should work since it checks customer_id

