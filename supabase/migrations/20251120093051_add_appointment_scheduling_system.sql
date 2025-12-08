/*
  # Add Appointment Scheduling System

  1. New Tables
    - `appointments`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to support_tickets)
      - `customer_id` (uuid, foreign key to profiles)
      - `technician_id` (uuid, foreign key to profiles)
      - `scheduled_start` (timestamptz)
      - `scheduled_end` (timestamptz)
      - `actual_start` (timestamptz, optional)
      - `actual_end` (timestamptz, optional)
      - `status` (text) - scheduled, confirmed, in_progress, completed, cancelled, no_show
      - `appointment_type` (text) - on_site, remote, phone_call
      - `location_address` (text, optional)
      - `location_lat` (numeric, optional)
      - `location_lng` (numeric, optional)
      - `notes` (text, optional)
      - `cancellation_reason` (text, optional)
      - `cancelled_by` (uuid, optional)
      - `cancelled_at` (timestamptz, optional)
      - `reminder_sent` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `technician_availability`
      - `id` (uuid, primary key)
      - `technician_id` (uuid, foreign key to profiles)
      - `day_of_week` (integer, 0-6, 0=Sunday)
      - `start_time` (time)
      - `end_time` (time)
      - `is_available` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `blocked_time_slots`
      - `id` (uuid, primary key)
      - `technician_id` (uuid, foreign key to profiles)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `reason` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can view their own appointments
    - Technicians can manage their availability
    - Admins can view all appointments
*/

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  technician_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  appointment_type text NOT NULL CHECK (appointment_type IN ('on_site', 'remote', 'phone_call')),
  location_address text,
  location_lat numeric,
  location_lng numeric,
  notes text,
  cancellation_reason text,
  cancelled_by uuid REFERENCES profiles(id),
  cancelled_at timestamptz,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create technician availability table
CREATE TABLE IF NOT EXISTS technician_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(technician_id, day_of_week, start_time)
);

-- Create blocked time slots table
CREATE TABLE IF NOT EXISTS blocked_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_technician ON appointments(technician_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_start ON appointments(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_technician_availability_technician ON technician_availability(technician_id);
CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_technician ON blocked_time_slots(technician_id);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_time_slots ENABLE ROW LEVEL SECURITY;

-- Appointments policies
CREATE POLICY "Users can view their own appointments"
  ON appointments FOR SELECT
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

CREATE POLICY "Customers and admins can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update their appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Technician availability policies
CREATE POLICY "Everyone can view technician availability"
  ON technician_availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Technicians can manage their availability"
  ON technician_availability FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Technicians can update their availability"
  ON technician_availability FOR UPDATE
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

CREATE POLICY "Technicians can delete their availability"
  ON technician_availability FOR DELETE
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Blocked time slots policies
CREATE POLICY "Everyone can view blocked time slots"
  ON blocked_time_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Technicians can manage their blocked slots"
  ON blocked_time_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Technicians can delete their blocked slots"
  ON blocked_time_slots FOR DELETE
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );