/*
  # Add Final Payment Tracking for On-Site Services

  1. Changes to `support_tickets` table
    - Add `initial_payment_amount` (numeric) - Stores the initial 50% payment for on-site services
    - Add `final_payment_made` (boolean) - Tracks if the final 50% payment has been made
    - Add `final_payment_amount` (numeric) - Stores the final payment amount
    - Add `final_payment_made_at` (timestamptz) - Timestamp when final payment was submitted
    - Add `final_payment_reference` (text) - Payment reference for the final payment
    - Add `final_payment_confirmed` (boolean) - Admin confirmation of final payment
    - Add `final_payment_confirmed_at` (timestamptz) - Timestamp of final payment confirmation
    - Add `final_payment_confirmed_by` (uuid) - Admin who confirmed the final payment

  2. Purpose
    - Enable tracking of two-part payment system for on-site visits
    - Initial payment (50%) authorizes work to begin
    - Final payment (50%) required after job completion
    - Admin can see and confirm both payments separately
*/

-- Add final payment tracking columns to support_tickets
ALTER TABLE support_tickets 
  ADD COLUMN IF NOT EXISTS initial_payment_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_payment_made boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_payment_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_payment_made_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_reference text,
  ADD COLUMN IF NOT EXISTS final_payment_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_confirmed_by uuid REFERENCES profiles(id);

-- Migrate existing on-site tickets to use the new structure
-- For resolved on-site tickets with payment, assume initial payment was made
UPDATE support_tickets
SET initial_payment_amount = payment_amount
WHERE service_type = 'on_site' 
  AND payment_made = true
  AND initial_payment_amount = 0;

-- Add index for faster queries on final payment status
CREATE INDEX IF NOT EXISTS idx_support_tickets_final_payment 
  ON support_tickets(final_payment_made, final_payment_confirmed)
  WHERE service_type = 'on_site';
