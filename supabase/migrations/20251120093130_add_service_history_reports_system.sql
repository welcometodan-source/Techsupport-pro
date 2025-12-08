/*
  # Add Service History & Reports System

  1. New Tables
    - `service_records`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to support_tickets)
      - `customer_id` (uuid, foreign key to profiles)
      - `technician_id` (uuid, foreign key to profiles)
      - `vehicle_make` (text)
      - `vehicle_model` (text)
      - `vehicle_year` (integer)
      - `vehicle_vin` (text, optional)
      - `service_type` (text)
      - `service_category` (text)
      - `problem_description` (text)
      - `diagnosis` (text)
      - `work_performed` (text)
      - `parts_used` (jsonb)
      - `labor_hours` (numeric)
      - `parts_cost` (numeric)
      - `labor_cost` (numeric)
      - `total_cost` (numeric)
      - `warranty_until` (date, optional)
      - `next_service_due` (date, optional)
      - `next_service_mileage` (integer, optional)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `vehicle_maintenance_reminders`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to profiles)
      - `vehicle_vin` (text)
      - `reminder_type` (text) - oil_change, tire_rotation, brake_check, etc.
      - `due_date` (date)
      - `due_mileage` (integer, optional)
      - `is_completed` (boolean)
      - `completed_at` (timestamptz, optional)
      - `reminder_sent` (boolean)
      - `created_at` (timestamptz)
    
    - `service_reports`
      - `id` (uuid, primary key)
      - `service_record_id` (uuid, foreign key to service_records)
      - `report_type` (text) - pdf, detailed, summary
      - `report_data` (jsonb)
      - `generated_by` (uuid, foreign key to profiles)
      - `generated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Customers can view their own service records
    - Technicians can view and create service records they worked on
    - Admins can view all records
*/

-- Create service records table
CREATE TABLE IF NOT EXISTS service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  technician_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year integer,
  vehicle_vin text,
  service_type text NOT NULL,
  service_category text NOT NULL,
  problem_description text NOT NULL,
  diagnosis text,
  work_performed text,
  parts_used jsonb DEFAULT '[]'::jsonb,
  labor_hours numeric DEFAULT 0,
  parts_cost numeric DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  warranty_until date,
  next_service_due date,
  next_service_mileage integer,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create vehicle maintenance reminders table
CREATE TABLE IF NOT EXISTS vehicle_maintenance_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_vin text,
  reminder_type text NOT NULL CHECK (reminder_type IN ('oil_change', 'tire_rotation', 'brake_check', 'transmission_service', 'coolant_flush', 'battery_check', 'general_inspection', 'other')),
  due_date date NOT NULL,
  due_mileage integer,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create service reports table
CREATE TABLE IF NOT EXISTS service_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_record_id uuid REFERENCES service_records(id) ON DELETE CASCADE NOT NULL,
  report_type text DEFAULT 'summary' CHECK (report_type IN ('pdf', 'detailed', 'summary')),
  report_data jsonb DEFAULT '{}'::jsonb,
  generated_by uuid REFERENCES profiles(id),
  generated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_service_records_customer ON service_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_records_technician ON service_records(technician_id);
CREATE INDEX IF NOT EXISTS idx_service_records_ticket ON service_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_records_vin ON service_records(vehicle_vin);
CREATE INDEX IF NOT EXISTS idx_vehicle_reminders_customer ON vehicle_maintenance_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_reminders_due_date ON vehicle_maintenance_reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_service_reports_record ON service_reports(service_record_id);

-- Enable RLS
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_reports ENABLE ROW LEVEL SECURITY;

-- Service records policies
CREATE POLICY "Customers can view their own service records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Technicians can create service records"
  ON service_records FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Technicians can update their service records"
  ON service_records FOR UPDATE
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Vehicle maintenance reminders policies
CREATE POLICY "Customers can view their maintenance reminders"
  ON vehicle_maintenance_reminders FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

CREATE POLICY "System can create maintenance reminders"
  ON vehicle_maintenance_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Customers can update their reminders"
  ON vehicle_maintenance_reminders FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

-- Service reports policies
CREATE POLICY "Users can view their service reports"
  ON service_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records
      WHERE service_records.id = service_reports.service_record_id
      AND (service_records.customer_id = auth.uid() OR service_records.technician_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Technicians can create service reports"
  ON service_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    generated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );