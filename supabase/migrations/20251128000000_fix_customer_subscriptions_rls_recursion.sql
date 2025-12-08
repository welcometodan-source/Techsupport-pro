/*
  # Fix Customer Subscriptions RLS Infinite Recursion

  ## Problem
  The "Technicians can view assigned subscriptions" policy on `customer_subscriptions` queries
  `subscription_assignments`, and the "Customers can view assignments for their subscriptions" 
  policy on `subscription_assignments` queries `customer_subscriptions`, creating infinite recursion.

  ## Solution
  1. Drop the problematic policies
  2. Create SECURITY DEFINER functions to check user roles without triggering RLS
  3. Recreate policies using these functions to avoid recursion

  ## Changes
  - Drop "Technicians can view assigned subscriptions" policy
  - Drop "Customers can view assignments for their subscriptions" policy  
  - Create helper functions to check roles without RLS recursion
  - Recreate policies using the helper functions
*/

-- ============================================
-- STEP 1: Drop problematic policies
-- ============================================

DROP POLICY IF EXISTS "Technicians can view assigned subscriptions" ON customer_subscriptions;
DROP POLICY IF EXISTS "Customers can view assignments for their subscriptions" ON subscription_assignments;

-- ============================================
-- STEP 2: Create helper functions (SECURITY DEFINER bypasses RLS)
-- ============================================

-- Function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND role = 'admin'
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is technician (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_technician()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND role = 'technician'
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if technician has active assignment for subscription (bypasses RLS)
CREATE OR REPLACE FUNCTION public.technician_has_active_assignment(sub_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM subscription_assignments
    WHERE subscription_assignments.subscription_id = sub_id
      AND subscription_assignments.technician_id = auth.uid()
      AND subscription_assignments.status = 'active'
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if subscription belongs to customer (bypasses RLS)
CREATE OR REPLACE FUNCTION public.subscription_belongs_to_customer(sub_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM customer_subscriptions
    WHERE customer_subscriptions.id = sub_id
      AND customer_subscriptions.user_id = auth.uid()
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- STEP 3: Recreate policies using helper functions
-- ============================================

-- Technicians can view subscriptions they are assigned to (using function to avoid recursion)
CREATE POLICY "Technicians can view assigned subscriptions"
  ON customer_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_technician() 
    AND public.technician_has_active_assignment(customer_subscriptions.id)
  );

-- Customers can view assignments for their subscriptions (using function to avoid recursion)
CREATE POLICY "Customers can view assignments for their subscriptions"
  ON subscription_assignments
  FOR SELECT
  TO authenticated
  USING (
    public.subscription_belongs_to_customer(subscription_assignments.subscription_id)
  );

-- ============================================
-- STEP 4: Also fix admin policies to use helper function (prevents future issues)
-- ============================================

-- Drop and recreate admin policy for customer_subscriptions
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON customer_subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON customer_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Drop and recreate admin policies for subscription_assignments
DROP POLICY IF EXISTS "Admins can manage all assignments" ON subscription_assignments;
CREATE POLICY "Admins can manage all assignments"
  ON subscription_assignments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- STEP 5: Fix admin policies for subscription_visits (prevent future issues)
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all visits" ON subscription_visits;
CREATE POLICY "Admins can manage all visits"
  ON subscription_visits
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

