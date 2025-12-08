/*
  # Add Payment Methods Management System

  1. New Tables
    - `payment_methods`
      - `id` (uuid, primary key)
      - `method_name` (text) - Display name of payment method (e.g., "Cash", "Credit Card", "PayPal")
      - `method_type` (text) - Type identifier (e.g., "cash", "card", "paypal", "bank_transfer")
      - `description` (text, optional) - Additional details about the payment method
      - `is_active` (boolean) - Whether this payment method is currently available
      - `display_order` (integer) - Order in which methods appear in dropdown
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `payment_methods` table
    - Add policy for all authenticated users to read active payment methods
    - Add policy for admins to manage (insert, update, delete) payment methods

  3. Initial Data
    - Insert default payment methods (Cash, Credit Card, Bank Transfer, PayPal)
*/

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_name text NOT NULL,
  method_type text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read active payment methods
CREATE POLICY "Authenticated users can view active payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy: Admins can view all payment methods
CREATE POLICY "Admins can view all payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can insert payment methods
CREATE POLICY "Admins can insert payment methods"
  ON payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update payment methods
CREATE POLICY "Admins can update payment methods"
  ON payment_methods
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can delete payment methods
CREATE POLICY "Admins can delete payment methods"
  ON payment_methods
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default payment methods
INSERT INTO payment_methods (method_name, method_type, description, is_active, display_order)
VALUES
  ('Cash', 'cash', 'Pay with cash at time of service', true, 1),
  ('Credit Card', 'card', 'Pay with credit or debit card', true, 2),
  ('Bank Transfer', 'bank_transfer', 'Direct bank transfer payment', true, 3),
  ('PayPal', 'paypal', 'Pay securely with PayPal', true, 4)
ON CONFLICT DO NOTHING;