/*
  # Fix Customer Subscriptions Foreign Key Reference

  1. Changes
    - Drop the existing foreign key constraint from tier_id to subscription_tiers
    - Rename tier_id column to subscription_plan_id for clarity
    - Add new foreign key constraint to subscription_plans table
    - This allows customer_subscriptions to properly reference CarDoc/AutoDoc plans

  2. Notes
    - Existing VIP/VVIP tiers remain in subscription_tiers for support priority
    - CarDoc/AutoDoc plans in subscription_plans are for vehicle maintenance subscriptions
    - These are two separate subscription systems that serve different purposes
*/

-- Drop existing foreign key constraint
ALTER TABLE customer_subscriptions 
DROP CONSTRAINT IF EXISTS customer_subscriptions_tier_id_fkey;

-- Rename column for clarity (tier_id -> subscription_plan_id is more accurate)
-- Since the column might already exist, handle both cases
DO $$
BEGIN
  -- Check if we need to rename or if subscription_plan_id already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_subscriptions' AND column_name = 'tier_id'
  ) THEN
    ALTER TABLE customer_subscriptions 
    RENAME COLUMN tier_id TO subscription_plan_id;
  END IF;
END $$;

-- Add foreign key constraint to subscription_plans
ALTER TABLE customer_subscriptions
ADD CONSTRAINT customer_subscriptions_subscription_plan_id_fkey
FOREIGN KEY (subscription_plan_id)
REFERENCES subscription_plans(id)
ON DELETE CASCADE;
