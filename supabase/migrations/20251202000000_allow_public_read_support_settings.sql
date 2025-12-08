/*
  # Allow Public Read Access to Support Contact Settings

  1. Changes
    - Update RLS policy to allow anonymous/public users to read support contact settings
    - This enables the CustomerCarePage to display contact information to unauthenticated users
    - Support contact settings include: support_phone, support_email, support_country, support_city, support_hours

  2. Security
    - Only SELECT operations are allowed for anonymous users
    - INSERT/UPDATE/DELETE still require admin authentication
    - This is safe as contact information is meant to be public
*/

-- Drop the existing read policy
DROP POLICY IF EXISTS "Anyone can read admin settings" ON admin_settings;

-- Create a new policy that allows both authenticated and anonymous users to read
CREATE POLICY "Anyone can read admin settings"
  ON admin_settings
  FOR SELECT
  USING (true);

