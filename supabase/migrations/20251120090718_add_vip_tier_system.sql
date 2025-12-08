/*
  # Add VIP Tier System for Customer Loyalty

  1. Changes to profiles table
    - Add `vip_tier` column (text) to store customer tier level
    - Valid values: null (regular), 'vip', 'vvip', 'gold', 'diamond', 'silver'
    - Add `vip_granted_at` timestamp to track when VIP status was granted
    - Add `vip_granted_by` to track which admin granted the status

  2. Security
    - Customers can read their own VIP tier
    - Only admins can update VIP tier status
    - Add policy for admins to manage VIP tiers

  3. Notes
    - VIP tiers provide priority support and recognition
    - Admins can upgrade loyal customers after 2+ weeks of good relationship
    - Badge will be displayed prominently on customer profiles
*/

-- Add VIP tier columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'vip_tier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vip_tier text CHECK (vip_tier IN ('vip', 'vvip', 'gold', 'diamond', 'silver'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'vip_granted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vip_granted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'vip_granted_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vip_granted_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Create index for faster VIP tier queries
CREATE INDEX IF NOT EXISTS idx_profiles_vip_tier ON profiles(vip_tier) WHERE vip_tier IS NOT NULL;

-- Add policy for admins to update VIP tiers
CREATE POLICY "Admins can update VIP tiers"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
  );
