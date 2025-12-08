/*
  # Add CarDoc and AutoDoc VIP Tiers

  1. Changes
    - Modify vip_tier check constraint to include 'cardoc' and 'autodoc' options
    - Maintains existing tiers: vip, vvip, gold, diamond, silver
    - Adds new tiers: cardoc, autodoc

  2. Notes
    - CarDoc and AutoDoc tiers are for subscription plan customers
    - Existing VIP tier data remains unchanged
*/

-- Drop the existing constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_vip_tier_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_vip_tier_check;
  END IF;
END $$;

-- Add new constraint with cardoc and autodoc
ALTER TABLE profiles
ADD CONSTRAINT profiles_vip_tier_check
CHECK (vip_tier IN ('vip', 'vvip', 'gold', 'diamond', 'silver', 'cardoc', 'autodoc'));