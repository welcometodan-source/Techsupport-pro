/*
  # Technician Visit Tracking System

  ## Overview
  This migration creates a comprehensive system for tracking technician visits to customer subscriptions,
  including visit assignments, reports, inspections, findings, and admin confirmation workflow.

  ## New Tables

  ### 1. `subscription_assignments`
  Tracks which technician is assigned to handle a customer's subscription
  - `id` (uuid, primary key)
  - `subscription_id` (uuid, references customer_subscriptions)
  - `technician_id` (uuid, references profiles)
  - `assigned_by` (uuid, references profiles) - admin who made assignment
  - `assigned_at` (timestamptz)
  - `status` (text) - active, completed, reassigned
  - `notes` (text) - assignment notes

  ### 2. `subscription_visits`
  Tracks individual visits made by technicians
  - `id` (uuid, primary key)
  - `subscription_id` (uuid, references customer_subscriptions)
  - `assignment_id` (uuid, references subscription_assignments)
  - `technician_id` (uuid, references profiles)
  - `visit_number` (integer) - 1st, 2nd, 3rd visit etc.
  - `scheduled_date` (timestamptz) - when visit is scheduled
  - `started_at` (timestamptz) - when technician started work
  - `completed_at` (timestamptz) - when technician completed work
  - `confirmed_at` (timestamptz) - when admin confirmed visit
  - `confirmed_by` (uuid, references profiles) - admin who confirmed
  - `status` (text) - scheduled, in_progress, pending_confirmation, confirmed, rejected
  - `vehicle_id` (uuid) - which vehicle was serviced
  - `location` (text) - service location
  - `report` (text) - technician's detailed report
  - `findings` (text) - key findings and issues discovered
  - `recommendations` (text) - recommended actions
  - `work_performed` (text) - specific work completed
  - `parts_used` (jsonb) - array of parts used
  - `duration_minutes` (integer) - how long the visit took
  - `rejection_reason` (text) - if admin rejects, why
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `visit_inspections`
  Detailed inspection checklist items for each visit
  - `id` (uuid, primary key)
  - `visit_id` (uuid, references subscription_visits)
  - `category` (text) - engine, brakes, tires, electrical, etc.
  - `item` (text) - specific item checked
  - `status` (text) - good, fair, needs_attention, critical
  - `notes` (text) - additional notes
  - `created_at` (timestamptz)

  ### 4. `visit_photos`
  Photos uploaded by technician during visit
  - `id` (uuid, primary key)
  - `visit_id` (uuid, references subscription_visits)
  - `photo_url` (text) - path in storage
  - `caption` (text) - description
  - `category` (text) - before, after, issue, general
  - `uploaded_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Technicians can create and update their own visit reports
  - Admins can view all visits and confirm them
  - Customers can view visits related to their subscriptions

  ## Indexes
  - Index on subscription_id for fast visit lookups
  - Index on technician_id for technician workload queries
  - Index on status for filtering pending confirmations
*/

-- Create subscription_assignments table
CREATE TABLE IF NOT EXISTS subscription_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES customer_subscriptions(id) ON DELETE CASCADE NOT NULL,
  technician_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now() NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'reassigned')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create subscription_visits table
CREATE TABLE IF NOT EXISTS subscription_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES customer_subscriptions(id) ON DELETE CASCADE NOT NULL,
  assignment_id uuid REFERENCES subscription_assignments(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  visit_number integer NOT NULL DEFAULT 1,
  scheduled_date timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES profiles(id),
  status text DEFAULT 'scheduled' NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'pending_confirmation', 'confirmed', 'rejected')),
  vehicle_id uuid,
  location text,
  report text,
  findings text,
  recommendations text,
  work_performed text,
  parts_used jsonb DEFAULT '[]'::jsonb,
  duration_minutes integer,
  rejection_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create visit_inspections table
CREATE TABLE IF NOT EXISTS visit_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES subscription_visits(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  item text NOT NULL,
  status text NOT NULL CHECK (status IN ('good', 'fair', 'needs_attention', 'critical')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create visit_photos table
CREATE TABLE IF NOT EXISTS visit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES subscription_visits(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  caption text,
  category text DEFAULT 'general' CHECK (category IN ('before', 'after', 'issue', 'general')),
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_assignments_subscription ON subscription_assignments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_assignments_technician ON subscription_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_subscription_assignments_status ON subscription_assignments(status);

CREATE INDEX IF NOT EXISTS idx_subscription_visits_subscription ON subscription_visits(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_visits_technician ON subscription_visits(technician_id);
CREATE INDEX IF NOT EXISTS idx_subscription_visits_status ON subscription_visits(status);
CREATE INDEX IF NOT EXISTS idx_subscription_visits_assignment ON subscription_visits(assignment_id);

CREATE INDEX IF NOT EXISTS idx_visit_inspections_visit ON visit_inspections(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_photos_visit ON visit_photos(visit_id);

-- Enable RLS
ALTER TABLE subscription_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_assignments

-- Admins can do everything with assignments
CREATE POLICY "Admins can manage all assignments"
  ON subscription_assignments
  FOR ALL
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

-- Technicians can view their own assignments
CREATE POLICY "Technicians can view own assignments"
  ON subscription_assignments
  FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
  );

-- Customers can view assignments for their subscriptions
CREATE POLICY "Customers can view assignments for their subscriptions"
  ON subscription_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer_subscriptions
      WHERE customer_subscriptions.id = subscription_assignments.subscription_id
      AND customer_subscriptions.user_id = auth.uid()
    )
  );

-- RLS Policies for subscription_visits

-- Admins can manage all visits
CREATE POLICY "Admins can manage all visits"
  ON subscription_visits
  FOR ALL
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

-- Technicians can create visits for their assignments
CREATE POLICY "Technicians can create own visits"
  ON subscription_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'technician'
      AND profiles.status = 'active'
    )
  );

-- Technicians can update their own visits (before confirmation)
CREATE POLICY "Technicians can update own visits"
  ON subscription_visits
  FOR UPDATE
  TO authenticated
  USING (
    technician_id = auth.uid()
    AND status IN ('scheduled', 'in_progress', 'pending_confirmation')
  )
  WITH CHECK (
    technician_id = auth.uid()
  );

-- Technicians can view their own visits
CREATE POLICY "Technicians can view own visits"
  ON subscription_visits
  FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
  );

-- Customers can view visits for their subscriptions
CREATE POLICY "Customers can view visits for their subscriptions"
  ON subscription_visits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer_subscriptions
      WHERE customer_subscriptions.id = subscription_visits.subscription_id
      AND customer_subscriptions.user_id = auth.uid()
    )
  );

-- RLS Policies for visit_inspections

-- Technicians can manage inspections for their visits
CREATE POLICY "Technicians can manage own visit inspections"
  ON visit_inspections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscription_visits
      WHERE subscription_visits.id = visit_inspections.visit_id
      AND subscription_visits.technician_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subscription_visits
      WHERE subscription_visits.id = visit_inspections.visit_id
      AND subscription_visits.technician_id = auth.uid()
    )
  );

-- Admins can view all inspections
CREATE POLICY "Admins can view all inspections"
  ON visit_inspections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Customers can view inspections for their subscription visits
CREATE POLICY "Customers can view inspections for their visits"
  ON visit_inspections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscription_visits sv
      JOIN customer_subscriptions cs ON cs.id = sv.subscription_id
      WHERE sv.id = visit_inspections.visit_id
      AND cs.user_id = auth.uid()
    )
  );

-- RLS Policies for visit_photos

-- Technicians can manage photos for their visits
CREATE POLICY "Technicians can manage own visit photos"
  ON visit_photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscription_visits
      WHERE subscription_visits.id = visit_photos.visit_id
      AND subscription_visits.technician_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subscription_visits
      WHERE subscription_visits.id = visit_photos.visit_id
      AND subscription_visits.technician_id = auth.uid()
    )
  );

-- Admins can view all photos
CREATE POLICY "Admins can view all photos"
  ON visit_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Customers can view photos for their subscription visits
CREATE POLICY "Customers can view photos for their visits"
  ON visit_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscription_visits sv
      JOIN customer_subscriptions cs ON cs.id = sv.subscription_id
      WHERE sv.id = visit_photos.visit_id
      AND cs.user_id = auth.uid()
    )
  );

-- Create storage bucket for visit photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for visit photos
CREATE POLICY "Authenticated users can upload visit photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND (
      -- Technicians can upload
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('technician', 'admin')
      )
    )
  );

CREATE POLICY "Users can view visit photos they have access to"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visit-photos'
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_subscription_assignments_updated_at
  BEFORE UPDATE ON subscription_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_visits_updated_at
  BEFORE UPDATE ON subscription_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
