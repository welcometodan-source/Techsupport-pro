/*
  # Automotive Support Call Center - Initial Database Schema

  ## Overview
  This migration creates the complete database schema for an automotive support call center application.

  ## New Tables

  ### 1. `profiles`
  Extends auth.users with additional user information
  - `id` (uuid, FK to auth.users)
  - `full_name` (text) - User's full name
  - `phone` (text) - Contact phone number
  - `role` (text) - User role: 'customer', 'technician', 'admin'
  - `avatar_url` (text) - Profile picture URL
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `subscription_tiers`
  Defines available subscription levels
  - `id` (uuid, PK)
  - `name` (text) - Tier name: 'Basic', 'VIP', 'VVIP', etc.
  - `price` (numeric) - Monthly price
  - `priority_level` (integer) - Higher number = higher priority
  - `max_monthly_calls` (integer) - Call limit per month (null = unlimited)
  - `response_time_minutes` (integer) - Guaranteed response time
  - `features` (jsonb) - Additional features as JSON
  - `created_at` (timestamptz)

  ### 3. `customer_subscriptions`
  Tracks customer subscription status
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to profiles)
  - `tier_id` (uuid, FK to subscription_tiers)
  - `status` (text) - 'active', 'cancelled', 'expired'
  - `start_date` (timestamptz)
  - `end_date` (timestamptz)
  - `auto_renew` (boolean)
  - `created_at` (timestamptz)

  ### 4. `support_tickets`
  Main support request system
  - `id` (uuid, PK)
  - `customer_id` (uuid, FK to profiles)
  - `assigned_technician_id` (uuid, FK to profiles)
  - `title` (text) - Brief problem description
  - `description` (text) - Detailed problem description
  - `status` (text) - 'open', 'in_progress', 'resolved', 'closed'
  - `priority` (text) - 'low', 'medium', 'high', 'urgent'
  - `category` (text) - 'engine', 'transmission', 'electrical', 'brakes', etc.
  - `vehicle_info` (jsonb) - Car details
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `resolved_at` (timestamptz)

  ### 5. `ticket_messages`
  Chat messages within support tickets
  - `id` (uuid, PK)
  - `ticket_id` (uuid, FK to support_tickets)
  - `sender_id` (uuid, FK to profiles)
  - `message` (text) - Text message content
  - `message_type` (text) - 'text', 'image', 'video', 'audio', 'file'
  - `media_url` (text) - URL to uploaded media
  - `created_at` (timestamptz)

  ### 6. `service_requests`
  On-site visit requests
  - `id` (uuid, PK)
  - `ticket_id` (uuid, FK to support_tickets)
  - `customer_id` (uuid, FK to profiles)
  - `technician_id` (uuid, FK to profiles)
  - `service_type` (text) - 'home_visit', 'garage_visit'
  - `address` (text) - Visit location
  - `scheduled_date` (timestamptz)
  - `status` (text) - 'requested', 'approved', 'scheduled', 'completed', 'cancelled'
  - `estimated_cost` (numeric)
  - `final_cost` (numeric)
  - `notes` (text)
  - `created_at` (timestamptz)
  - `completed_at` (timestamptz)

  ### 7. `payments`
  Payment transaction records
  - `id` (uuid, PK)
  - `customer_id` (uuid, FK to profiles)
  - `service_request_id` (uuid, FK to service_requests, nullable)
  - `subscription_id` (uuid, FK to customer_subscriptions, nullable)
  - `amount` (numeric)
  - `currency` (text)
  - `payment_method` (text)
  - `payment_status` (text) - 'pending', 'completed', 'failed', 'refunded'
  - `stripe_payment_id` (text)
  - `created_at` (timestamptz)

  ### 8. `call_logs`
  Track phone call sessions
  - `id` (uuid, PK)
  - `ticket_id` (uuid, FK to support_tickets)
  - `customer_id` (uuid, FK to profiles)
  - `technician_id` (uuid, FK to profiles)
  - `start_time` (timestamptz)
  - `end_time` (timestamptz)
  - `duration_minutes` (integer)
  - `call_type` (text) - 'consultation', 'follow_up'
  - `notes` (text)
  - `created_at` (timestamptz)

  ### 9. `notifications`
  User notification system
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to profiles)
  - `title` (text)
  - `message` (text)
  - `type` (text) - 'ticket_update', 'payment', 'schedule', 'system'
  - `read` (boolean)
  - `related_id` (uuid) - ID of related entity
  - `created_at` (timestamptz)

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Customers can only view/edit their own data
  - Technicians can view assigned tickets
  - Admins have full access
  - Public cannot access any data without authentication

  ## Important Notes
  1. All timestamps use timestamptz for timezone awareness
  2. Subscription tiers are pre-populated with sample data
  3. Profile created automatically on user signup via trigger
  4. Comprehensive indexes for query performance
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'technician', 'admin')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Technicians can view customer profiles" ON profiles;
CREATE POLICY "Technicians can view customer profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid() AND p.role IN ('technician', 'admin')
    )
  );

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  priority_level integer NOT NULL,
  max_monthly_calls integer,
  response_time_minutes integer NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view subscription tiers" ON subscription_tiers;
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  TO authenticated
  USING (true);

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, price, priority_level, max_monthly_calls, response_time_minutes, features)
VALUES
  ('Basic', 0, 1, 5, 60, '["Email support", "Basic consultation"]'::jsonb),
  ('VIP', 29.99, 2, 15, 30, '["Priority support", "Video calls", "Monthly check-in"]'::jsonb),
  ('VVIP', 79.99, 3, null, 15, '["24/7 support", "Unlimited calls", "Home visits discount", "Dedicated technician"]'::jsonb),
  ('Premium', 149.99, 4, null, 5, '["Immediate response", "Unlimited everything", "Free home visits", "Personal account manager"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create customer_subscriptions table
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES subscription_tiers(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  auto_renew boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON customer_subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON customer_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON customer_subscriptions;
CREATE POLICY "Users can insert own subscriptions"
  ON customer_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON customer_subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON customer_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_technician_id uuid REFERENCES profiles(id),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category text NOT NULL CHECK (category IN ('engine', 'transmission', 'electrical', 'brakes', 'suspension', 'cooling', 'fuel_system', 'exhaust', 'body', 'other')),
  vehicle_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own tickets" ON support_tickets;
CREATE POLICY "Customers can view own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can create tickets" ON support_tickets;
CREATE POLICY "Customers can create tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update own tickets" ON support_tickets;
CREATE POLICY "Customers can update own tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Technicians can view assigned tickets" ON support_tickets;
CREATE POLICY "Technicians can view assigned tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    auth.uid() = assigned_technician_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  );

DROP POLICY IF EXISTS "Technicians can update tickets" ON support_tickets;
CREATE POLICY "Technicians can update tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  );

-- Create ticket_messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
  media_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their tickets" ON ticket_messages;
CREATE POLICY "Users can view messages in their tickets"
  ON ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND (support_tickets.customer_id = auth.uid() OR support_tickets.assigned_technician_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can send messages in their tickets" ON ticket_messages;
CREATE POLICY "Users can send messages in their tickets"
  ON ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    (EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND (support_tickets.customer_id = auth.uid() OR support_tickets.assigned_technician_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    ))
  );

-- Create service_requests table
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES profiles(id),
  service_type text NOT NULL CHECK (service_type IN ('home_visit', 'garage_visit')),
  address text NOT NULL,
  scheduled_date timestamptz,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  estimated_cost numeric(10,2),
  final_cost numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own service requests" ON service_requests;
CREATE POLICY "Customers can view own service requests"
  ON service_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can create service requests" ON service_requests;
CREATE POLICY "Customers can create service requests"
  ON service_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Technicians can view service requests" ON service_requests;
CREATE POLICY "Technicians can view service requests"
  ON service_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = technician_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  );

DROP POLICY IF EXISTS "Technicians can update service requests" ON service_requests;
CREATE POLICY "Technicians can update service requests"
  ON service_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  );

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_request_id uuid REFERENCES service_requests(id),
  subscription_id uuid REFERENCES customer_subscriptions(id),
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_method text,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create call_logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  duration_minutes integer,
  call_type text NOT NULL DEFAULT 'consultation' CHECK (call_type IN ('consultation', 'follow_up', 'emergency')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own call logs" ON call_logs;
CREATE POLICY "Users can view own call logs"
  ON call_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = technician_id);

DROP POLICY IF EXISTS "Technicians can create call logs" ON call_logs;
CREATE POLICY "Technicians can create call logs"
  ON call_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = technician_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('technician', 'admin')
    )
  );

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('ticket_update', 'payment', 'schedule', 'system', 'message')),
  read boolean DEFAULT false,
  related_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_technician ON support_tickets(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON support_tickets;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();