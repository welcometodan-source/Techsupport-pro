/*
  # Add Customer Preferences System

  1. New Tables
    - `customer_preferences`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to profiles)
      - `background_type` (text: 'color', 'gradient', 'image')
      - `background_value` (text: stores color hex, gradient values, or image URL)
      - `background_image_url` (text: URL to uploaded background image)
      - `primary_color` (text: hex color for primary UI elements)
      - `secondary_color` (text: hex color for secondary UI elements)
      - `card_style` (text: 'default', 'rounded', 'sharp', 'glass')
      - `font_size` (text: 'small', 'medium', 'large')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create bucket for customer background images
    - Set up RLS policies for customer uploads

  3. Security
    - Enable RLS on customer_preferences table
    - Add policies for customers to manage their own preferences
    - Secure storage bucket access

  4. Purpose
    - Allow customers to personalize their dashboard
    - Store background images and color preferences
    - Customize UI appearance per customer
*/

-- Create customer_preferences table
CREATE TABLE IF NOT EXISTS customer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  background_type text DEFAULT 'color' CHECK (background_type IN ('color', 'gradient', 'image')),
  background_value text DEFAULT '#f3f4f6',
  background_image_url text,
  primary_color text DEFAULT '#f97316',
  secondary_color text DEFAULT '#fb923c',
  card_style text DEFAULT 'default' CHECK (card_style IN ('default', 'rounded', 'sharp', 'glass')),
  font_size text DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create storage bucket for customer backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-backgrounds', 'customer-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on customer_preferences
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view their own preferences
CREATE POLICY "Customers can view own preferences"
  ON customer_preferences
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Policy: Customers can insert their own preferences
CREATE POLICY "Customers can insert own preferences"
  ON customer_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Policy: Customers can update their own preferences
CREATE POLICY "Customers can update own preferences"
  ON customer_preferences
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Storage policies for customer backgrounds
CREATE POLICY "Customers can upload own backgrounds"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-backgrounds' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view background images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'customer-backgrounds');

CREATE POLICY "Customers can update own backgrounds"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'customer-backgrounds' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Customers can delete own backgrounds"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'customer-backgrounds' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_customer_preferences_updated_at ON customer_preferences;
CREATE TRIGGER trigger_update_customer_preferences_updated_at
  BEFORE UPDATE ON customer_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_preferences_updated_at();

-- Create default preferences for existing customers
INSERT INTO customer_preferences (customer_id, background_type, background_value)
SELECT id, 'color', '#f3f4f6'
FROM profiles
WHERE role = 'customer'
ON CONFLICT (customer_id) DO NOTHING;
