/*
  # CarDoc/AutoDoc Subscription System

  ## Overview
  This migration creates a comprehensive preventative car maintenance subscription system
  that works alongside the existing support ticket system.

  ## New Tables

  ### 1. `subscription_plans`
  Defines the CarDoc and AutoDoc subscription plans with features and pricing
  - `id` (uuid, primary key)
  - `plan_name` (text) - "CarDoc" or "AutoDoc"
  - `plan_type` (text) - "weekly" or "bi_weekly"
  - `price_monthly` (numeric) - Monthly subscription price
  - `visits_per_month` (integer) - Number of scheduled visits
  - `description` (text) - Plan description
  - `features` (jsonb) - Array of plan features
  - `is_active` (boolean) - Whether plan is available for signup

  ### 2. `customer_vehicle_folders`
  Master folder for each customer's vehicles - stores all car records
  - `id` (uuid, primary key)
  - `customer_id` (uuid) - Links to profiles
  - `vehicle_make` (text)
  - `vehicle_model` (text)
  - `vehicle_year` (integer)
  - `vehicle_vin` (text, unique)
  - `license_plate` (text)
  - `subscription_plan_id` (uuid) - Active subscription plan
  - `folder_created_at` (timestamptz)
  - `last_inspection_date` (timestamptz)
  - `next_inspection_due` (timestamptz)

  ### 3. `scheduled_inspections`
  Scheduled weekly/bi-weekly inspection visits by technicians
  - `id` (uuid, primary key)
  - `vehicle_folder_id` (uuid)
  - `technician_id` (uuid)
  - `scheduled_date` (timestamptz)
  - `status` (text) - scheduled, completed, cancelled, missed
  - `inspection_type` (text) - routine, follow_up, special
  - `location_address` (text)
  - `completed_at` (timestamptz)
  - `report_generated` (boolean)

  ### 4. `inspection_reports`
  Comprehensive inspection findings from each technician visit
  - `id` (uuid, primary key)
  - `scheduled_inspection_id` (uuid)
  - `vehicle_folder_id` (uuid)
  - `technician_id` (uuid)
  - `inspection_date` (timestamptz)
  - `current_mileage` (integer)
  - `overall_health_score` (integer) - 0-100
  - `engine_status` (jsonb) - Detailed engine findings
  - `transmission_status` (jsonb)
  - `ac_status` (jsonb)
  - `electrical_status` (jsonb)
  - `underworks_status` (jsonb)
  - `brakes_status` (jsonb)
  - `suspension_status` (jsonb)
  - `other_systems` (jsonb)
  - `summary` (text)
  - `recommendations` (text)

  ### 5. `parts_recommendations`
  Tracking of parts that need attention or replacement
  - `id` (uuid, primary key)
  - `inspection_report_id` (uuid)
  - `vehicle_folder_id` (uuid)
  - `part_name` (text)
  - `part_category` (text)
  - `urgency` (text) - critical, urgent, moderate, monitor
  - `recommendation` (text)
  - `estimated_cost` (numeric)
  - `status` (text) - pending, approved, completed, declined
  - `needs_garage_visit` (boolean)
  - `notes` (text)

  ### 6. `cost_savings_tracker`
  Tracks money saved through proper diagnostics vs garage visits
  - `id` (uuid, primary key)
  - `vehicle_folder_id` (uuid)
  - `customer_id` (uuid)
  - `incident_description` (text)
  - `potential_garage_cost` (numeric) - What garage would charge
  - `actual_cost_recommended` (numeric) - What we recommended
  - `savings_amount` (numeric) - Money saved
  - `saved_date` (timestamptz)
  - `notes` (text)

  ## Security
  - RLS enabled on all tables
  - Customers can view their own data
  - Technicians can view assigned inspections
  - Admins have full access
*/

-- subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('weekly', 'bi_weekly')),
  price_monthly numeric NOT NULL DEFAULT 0,
  visits_per_month integer NOT NULL DEFAULT 4,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- customer_vehicle_folders table
CREATE TABLE IF NOT EXISTS customer_vehicle_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year integer,
  vehicle_vin text UNIQUE,
  license_plate text,
  subscription_plan_id uuid REFERENCES subscription_plans(id),
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'paused', 'cancelled', 'expired')),
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  folder_created_at timestamptz DEFAULT now(),
  last_inspection_date timestamptz,
  next_inspection_due timestamptz,
  total_inspections_completed integer DEFAULT 0,
  vehicle_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- scheduled_inspections table
CREATE TABLE IF NOT EXISTS scheduled_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_folder_id uuid REFERENCES customer_vehicle_folders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES profiles(id),
  scheduled_date timestamptz NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'missed')),
  inspection_type text DEFAULT 'routine' CHECK (inspection_type IN ('routine', 'follow_up', 'special', 'emergency')),
  location_address text NOT NULL,
  location_notes text,
  completed_at timestamptz,
  report_generated boolean DEFAULT false,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- inspection_reports table
CREATE TABLE IF NOT EXISTS inspection_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_inspection_id uuid REFERENCES scheduled_inspections(id) ON DELETE CASCADE,
  vehicle_folder_id uuid REFERENCES customer_vehicle_folders(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES profiles(id),
  inspection_date timestamptz DEFAULT now(),
  current_mileage integer,
  overall_health_score integer CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  engine_status jsonb DEFAULT '{}'::jsonb,
  transmission_status jsonb DEFAULT '{}'::jsonb,
  ac_status jsonb DEFAULT '{}'::jsonb,
  electrical_status jsonb DEFAULT '{}'::jsonb,
  underworks_status jsonb DEFAULT '{}'::jsonb,
  brakes_status jsonb DEFAULT '{}'::jsonb,
  suspension_status jsonb DEFAULT '{}'::jsonb,
  cooling_status jsonb DEFAULT '{}'::jsonb,
  fuel_system_status jsonb DEFAULT '{}'::jsonb,
  exhaust_status jsonb DEFAULT '{}'::jsonb,
  other_systems jsonb DEFAULT '{}'::jsonb,
  summary text,
  recommendations text,
  customer_notified boolean DEFAULT false,
  customer_viewed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- parts_recommendations table
CREATE TABLE IF NOT EXISTS parts_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_report_id uuid REFERENCES inspection_reports(id) ON DELETE CASCADE,
  vehicle_folder_id uuid REFERENCES customer_vehicle_folders(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  part_category text CHECK (part_category IN ('engine', 'transmission', 'electrical', 'brakes', 'suspension', 'cooling', 'fuel_system', 'exhaust', 'body', 'other')),
  urgency text DEFAULT 'monitor' CHECK (urgency IN ('critical', 'urgent', 'moderate', 'monitor')),
  recommendation text NOT NULL,
  estimated_cost numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'customer_notified', 'approved', 'completed', 'declined', 'on_hold')),
  needs_garage_visit boolean DEFAULT false,
  garage_visit_reason text,
  approved_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- cost_savings_tracker table
CREATE TABLE IF NOT EXISTS cost_savings_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_folder_id uuid REFERENCES customer_vehicle_folders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  incident_description text NOT NULL,
  potential_garage_cost numeric DEFAULT 0,
  actual_cost_recommended numeric DEFAULT 0,
  savings_amount numeric GENERATED ALWAYS AS (potential_garage_cost - actual_cost_recommended) STORED,
  parts_prevented text,
  proper_diagnosis_notes text,
  saved_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vehicle_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_savings_tracker ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for customer_vehicle_folders
CREATE POLICY "Customers can view own vehicle folders"
  ON customer_vehicle_folders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can create own vehicle folders"
  ON customer_vehicle_folders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update own vehicle folders"
  ON customer_vehicle_folders FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Technicians can view assigned vehicle folders"
  ON customer_vehicle_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'technician'
    )
    AND EXISTS (
      SELECT 1 FROM scheduled_inspections
      WHERE scheduled_inspections.vehicle_folder_id = customer_vehicle_folders.id
      AND scheduled_inspections.technician_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all vehicle folders"
  ON customer_vehicle_folders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for scheduled_inspections
CREATE POLICY "Customers can view own scheduled inspections"
  ON scheduled_inspections FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Technicians can view assigned inspections"
  ON scheduled_inspections FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Technicians can update assigned inspections"
  ON scheduled_inspections FOR UPDATE
  TO authenticated
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid());

CREATE POLICY "Admins can manage all inspections"
  ON scheduled_inspections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for inspection_reports
CREATE POLICY "Customers can view own inspection reports"
  ON inspection_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer_vehicle_folders
      WHERE customer_vehicle_folders.id = inspection_reports.vehicle_folder_id
      AND customer_vehicle_folders.customer_id = auth.uid()
    )
  );

CREATE POLICY "Technicians can create and update assigned reports"
  ON inspection_reports FOR INSERT
  TO authenticated
  WITH CHECK (technician_id = auth.uid());

CREATE POLICY "Technicians can update own reports"
  ON inspection_reports FOR UPDATE
  TO authenticated
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid());

CREATE POLICY "Admins can manage all reports"
  ON inspection_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for parts_recommendations
CREATE POLICY "Customers can view own parts recommendations"
  ON parts_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer_vehicle_folders
      WHERE customer_vehicle_folders.id = parts_recommendations.vehicle_folder_id
      AND customer_vehicle_folders.customer_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update recommendation status"
  ON parts_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer_vehicle_folders
      WHERE customer_vehicle_folders.id = parts_recommendations.vehicle_folder_id
      AND customer_vehicle_folders.customer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customer_vehicle_folders
      WHERE customer_vehicle_folders.id = parts_recommendations.vehicle_folder_id
      AND customer_vehicle_folders.customer_id = auth.uid()
    )
  );

CREATE POLICY "Technicians can manage recommendations"
  ON parts_recommendations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

-- RLS Policies for cost_savings_tracker
CREATE POLICY "Customers can view own cost savings"
  ON cost_savings_tracker FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Technicians and admins can manage cost savings"
  ON cost_savings_tracker FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin')
    )
  );

-- Insert default subscription plans
INSERT INTO subscription_plans (plan_name, plan_type, price_monthly, visits_per_month, description, features) VALUES
('CarDoc Weekly', 'weekly', 199.99, 4, 'Weekly comprehensive car health monitoring with detailed diagnostics', 
'["Weekly precision inspection", "Complete system checkup", "Detailed diagnostic reports", "Parts recommendation tracking", "Cost-saving analysis", "24/7 emergency support", "Garage visit optimization"]'::jsonb),
('CarDoc Bi-Weekly', 'bi_weekly', 129.99, 2, 'Bi-weekly comprehensive car health monitoring with detailed diagnostics',
'["Bi-weekly precision inspection", "Complete system checkup", "Detailed diagnostic reports", "Parts recommendation tracking", "Cost-saving analysis", "Emergency support", "Garage visit optimization"]'::jsonb),
('AutoDoc Premium Weekly', 'weekly', 299.99, 4, 'Premium weekly service with priority scheduling and advanced diagnostics',
'["Priority weekly inspection", "Advanced diagnostics", "Comprehensive reports", "Priority technician assignment", "Extended warranty coverage", "24/7 VIP support", "Free minor adjustments", "Unlimited consultations"]'::jsonb),
('AutoDoc Premium Bi-Weekly', 'bi_weekly', 199.99, 2, 'Premium bi-weekly service with priority scheduling and advanced diagnostics',
'["Priority bi-weekly inspection", "Advanced diagnostics", "Comprehensive reports", "Priority technician assignment", "Extended warranty coverage", "24/7 VIP support", "Free minor adjustments", "Unlimited consultations"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_folders_customer ON customer_vehicle_folders(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_folders_subscription ON customer_vehicle_folders(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_inspections_vehicle ON scheduled_inspections(vehicle_folder_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_inspections_technician ON scheduled_inspections(technician_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_inspections_date ON scheduled_inspections(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_vehicle ON inspection_reports(vehicle_folder_id);
CREATE INDEX IF NOT EXISTS idx_parts_recommendations_vehicle ON parts_recommendations(vehicle_folder_id);
CREATE INDEX IF NOT EXISTS idx_parts_recommendations_urgency ON parts_recommendations(urgency, status);
CREATE INDEX IF NOT EXISTS idx_cost_savings_customer ON cost_savings_tracker(customer_id);
