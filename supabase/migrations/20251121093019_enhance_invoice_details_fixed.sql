/*
  # Enhance Invoice Details

  1. New Columns
    - `company_name` (text) - Business name
    - `company_address` (text) - Business address
    - `company_phone` (text) - Business phone
    - `company_email` (text) - Business email
    - `customer_name` (text) - Customer full name
    - `customer_address` (text) - Customer address
    - `customer_phone` (text) - Customer phone
    - `technician_name` (text) - Technician who performed service
    - `labor_hours` (numeric) - Hours of labor
    - `labor_rate` (numeric) - Rate per hour
    - `parts_cost` (numeric) - Cost of parts
    - `tax_rate` (numeric) - Tax percentage
    - `tax_amount` (numeric) - Tax amount
    - `subtotal` (numeric) - Amount before tax
    - `discount_amount` (numeric) - Discount applied
    - `discount_reason` (text) - Reason for discount
    - `itemized_services` (jsonb) - List of services performed
    - `terms_and_conditions` (text) - Payment terms

  2. Purpose
    - Make invoices more professional and detailed
    - Include business information
    - Show itemized breakdown
    - Calculate taxes and discounts
    - Add legal terms
*/

-- Add new columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_name text DEFAULT 'AutoSupport Pro';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_address text DEFAULT '123 Auto Street, Car City, AC 12345';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_phone text DEFAULT '+1 (555) 123-4567';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_email text DEFAULT 'support@autosupportpro.com';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone text;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_name text;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS labor_hours numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS labor_rate numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parts_cost numeric DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS itemized_services jsonb DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_and_conditions text DEFAULT 'Payment is due upon receipt. Thank you for your business!';

-- Update existing invoices with basic information
UPDATE invoices i
SET 
  customer_name = p.full_name,
  customer_phone = p.phone,
  subtotal = i.amount,
  company_name = 'AutoSupport Pro',
  company_address = '123 Auto Street, Car City, AC 12345',
  company_phone = '+1 (555) 123-4567',
  company_email = 'support@autosupportpro.com'
FROM profiles p
WHERE i.customer_id = p.id
AND i.customer_name IS NULL;

-- Create a function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate subtotal from labor and parts if provided
  IF NEW.labor_hours > 0 OR NEW.parts_cost > 0 THEN
    NEW.subtotal := (COALESCE(NEW.labor_hours, 0) * COALESCE(NEW.labor_rate, 0)) + COALESCE(NEW.parts_cost, 0) - COALESCE(NEW.discount_amount, 0);
    
    -- Calculate tax amount
    IF NEW.tax_rate > 0 THEN
      NEW.tax_amount := NEW.subtotal * (NEW.tax_rate / 100);
    END IF;
    
    -- Calculate final amount
    NEW.amount := NEW.subtotal + COALESCE(NEW.tax_amount, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic calculation
DROP TRIGGER IF EXISTS trigger_calculate_invoice_totals ON invoices;
CREATE TRIGGER trigger_calculate_invoice_totals
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_totals();
