/*
  # Add Inventory Management System

  1. New Tables
    - `inventory_items`
      - `id` (uuid, primary key)
      - `part_number` (text, unique)
      - `part_name` (text)
      - `description` (text)
      - `category` (text)
      - `manufacturer` (text)
      - `quantity_in_stock` (integer)
      - `minimum_stock_level` (integer)
      - `unit_cost` (numeric)
      - `selling_price` (numeric)
      - `location` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `inventory_transactions`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to inventory_items)
      - `transaction_type` (text) - purchase, sale, adjustment, return
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `total_amount` (numeric)
      - `reference_id` (uuid) - ticket_id or service_record_id
      - `reference_type` (text) - ticket, service_record, manual
      - `performed_by` (uuid, foreign key to profiles)
      - `notes` (text)
      - `created_at` (timestamptz)
    
    - `low_stock_alerts`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to inventory_items)
      - `alert_level` (text) - low, critical
      - `current_quantity` (integer)
      - `minimum_required` (integer)
      - `is_resolved` (boolean)
      - `resolved_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Technicians and admins can view inventory
    - Only admins can modify inventory
    - Alerts are visible to technicians and admins
*/

-- Create inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text UNIQUE NOT NULL,
  part_name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('engine_parts', 'transmission', 'electrical', 'brakes', 'suspension', 'cooling', 'fuel_system', 'exhaust', 'body_parts', 'fluids', 'filters', 'other')),
  manufacturer text,
  quantity_in_stock integer DEFAULT 0 CHECK (quantity_in_stock >= 0),
  minimum_stock_level integer DEFAULT 5,
  unit_cost numeric DEFAULT 0,
  selling_price numeric DEFAULT 0,
  location text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) ON DELETE RESTRICT NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'adjustment', 'return')),
  quantity integer NOT NULL,
  unit_price numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  reference_id uuid,
  reference_type text CHECK (reference_type IN ('ticket', 'service_record', 'manual')),
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create low stock alerts table
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  alert_level text NOT NULL CHECK (alert_level IN ('low', 'critical')),
  current_quantity integer NOT NULL,
  minimum_required integer NOT NULL,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_part_number ON inventory_items(part_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference ON inventory_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_item ON low_stock_alerts(item_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_resolved ON low_stock_alerts(is_resolved);

-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE low_stock_alerts ENABLE ROW LEVEL SECURITY;

-- Inventory items policies
CREATE POLICY "Technicians and admins can view inventory"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

CREATE POLICY "Only admins can create inventory items"
  ON inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update inventory items"
  ON inventory_items FOR UPDATE
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

-- Inventory transactions policies
CREATE POLICY "Technicians and admins can view transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

CREATE POLICY "Technicians and admins can create transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

-- Low stock alerts policies
CREATE POLICY "Technicians and admins can view alerts"
  ON low_stock_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

CREATE POLICY "System can create alerts"
  ON low_stock_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts"
  ON low_stock_alerts FOR UPDATE
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

-- Function to update inventory stock
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'purchase' OR NEW.transaction_type = 'return' THEN
    UPDATE inventory_items
    SET quantity_in_stock = quantity_in_stock + NEW.quantity,
        updated_at = now()
    WHERE id = NEW.item_id;
  ELSIF NEW.transaction_type = 'sale' THEN
    UPDATE inventory_items
    SET quantity_in_stock = quantity_in_stock - NEW.quantity,
        updated_at = now()
    WHERE id = NEW.item_id;
  ELSIF NEW.transaction_type = 'adjustment' THEN
    UPDATE inventory_items
    SET quantity_in_stock = NEW.quantity,
        updated_at = now()
    WHERE id = NEW.item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check and create low stock alerts
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  item_record inventory_items;
BEGIN
  SELECT * INTO item_record FROM inventory_items WHERE id = NEW.item_id;
  
  IF item_record.quantity_in_stock <= 0 THEN
    INSERT INTO low_stock_alerts (item_id, alert_level, current_quantity, minimum_required)
    VALUES (NEW.item_id, 'critical', item_record.quantity_in_stock, item_record.minimum_stock_level)
    ON CONFLICT DO NOTHING;
  ELSIF item_record.quantity_in_stock <= item_record.minimum_stock_level THEN
    INSERT INTO low_stock_alerts (item_id, alert_level, current_quantity, minimum_required)
    VALUES (NEW.item_id, 'low', item_record.quantity_in_stock, item_record.minimum_stock_level)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_inventory_on_transaction ON inventory_transactions;
CREATE TRIGGER update_inventory_on_transaction
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock();

DROP TRIGGER IF EXISTS check_low_stock_on_transaction ON inventory_transactions;
CREATE TRIGGER check_low_stock_on_transaction
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock();