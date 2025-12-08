/*
  # Add Payment Tracking to Customer Subscriptions

  1. Changes
    - Add payment_confirmed column to track if admin has confirmed payment
    - Add payment_method column to store payment method used
    - Add payment_reference column to store payment transaction reference
    - Add last_payment_date column to track when last payment was made
    - Update status enum to include 'pending_payment' status

  2. Notes
    - These fields help admins manage subscription payments
    - Payment confirmation is required before activating subscription
    - Tracks payment history for customer subscriptions
*/

-- Add payment tracking columns to customer_subscriptions if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_subscriptions' AND column_name = 'payment_confirmed'
  ) THEN
    ALTER TABLE customer_subscriptions 
    ADD COLUMN payment_confirmed BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_subscriptions' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE customer_subscriptions 
    ADD COLUMN payment_method TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_subscriptions' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE customer_subscriptions 
    ADD COLUMN payment_reference TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_subscriptions' AND column_name = 'last_payment_date'
  ) THEN
    ALTER TABLE customer_subscriptions 
    ADD COLUMN last_payment_date TIMESTAMPTZ;
  END IF;
END $$;

-- Drop existing constraint if it exists
ALTER TABLE customer_subscriptions 
DROP CONSTRAINT IF EXISTS customer_subscriptions_status_check;

-- Add updated status constraint with pending_payment option
ALTER TABLE customer_subscriptions
ADD CONSTRAINT customer_subscriptions_status_check
CHECK (status IN ('active', 'cancelled', 'expired', 'pending_payment'));

-- Create index for faster payment status queries
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_payment_confirmed 
ON customer_subscriptions(payment_confirmed);

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status 
ON customer_subscriptions(status);
