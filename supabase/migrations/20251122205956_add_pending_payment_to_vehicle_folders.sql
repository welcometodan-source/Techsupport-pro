/*
  # Add pending_payment status to customer_vehicle_folders

  1. Changes
    - Update subscription_status check constraint to include 'pending_payment'
    - This allows vehicle folders to track pending payment subscriptions

  2. Notes
    - Necessary for proper subscription payment workflow
    - Vehicle folders should remain in pending_payment until admin confirms
*/

-- Drop existing constraint
ALTER TABLE customer_vehicle_folders 
DROP CONSTRAINT IF EXISTS customer_vehicle_folders_subscription_status_check;

-- Add updated constraint with pending_payment option
ALTER TABLE customer_vehicle_folders
ADD CONSTRAINT customer_vehicle_folders_subscription_status_check
CHECK (subscription_status IN ('active', 'paused', 'cancelled', 'expired', 'pending_payment'));

-- Update existing records that should be pending_payment
UPDATE customer_vehicle_folders cvf
SET subscription_status = 'pending_payment'
FROM customer_subscriptions cs
WHERE cvf.customer_subscription_id = cs.id
  AND cs.payment_confirmed = false
  AND cs.status = 'pending_payment'
  AND cvf.subscription_status = 'active';
