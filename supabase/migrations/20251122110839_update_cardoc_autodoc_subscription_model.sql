/*
  # Update CarDoc/AutoDoc Subscription Model

  ## Changes
  1. Update subscription plans to reflect correct pricing model:
     - Monthly and Yearly billing options
     - CarDoc = 1 car only
     - AutoDoc = 2-3 cars
     - Visit frequency: Once or twice per week
  
  2. Add billing_cycle field
  3. Add max_vehicles field
  4. Update pricing structure

  ## Updated Plans
  - CarDoc Monthly (1x/week): 1 car, 4 visits/month
  - CarDoc Monthly (2x/week): 1 car, 8 visits/month
  - CarDoc Yearly (1x/week): 1 car, ~48 visits/year
  - CarDoc Yearly (2x/week): 1 car, ~96 visits/year
  - AutoDoc Monthly (1x/week): 2-3 cars, 4 visits/month per car
  - AutoDoc Monthly (2x/week): 2-3 cars, 8 visits/month per car
  - AutoDoc Yearly (1x/week): 2-3 cars, ~48 visits/year per car
  - AutoDoc Yearly (2x/week): 2-3 cars, ~96 visits/year per car
*/

-- First, drop the old data
DELETE FROM subscription_plans;

-- Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_plans' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_plans' AND column_name = 'max_vehicles'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN max_vehicles integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_plans' AND column_name = 'plan_category'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN plan_category text CHECK (plan_category IN ('cardoc', 'autodoc'));
  END IF;
END $$;

-- Insert updated subscription plans
INSERT INTO subscription_plans (
  plan_name, 
  plan_type, 
  billing_cycle,
  plan_category,
  price_monthly, 
  visits_per_month,
  max_vehicles,
  description, 
  features
) VALUES
-- CarDoc Plans (1 car only)
(
  'CarDoc Monthly - 1x/Week',
  'weekly',
  'monthly',
  'cardoc',
  199.99,
  4,
  1,
  'Monthly subscription for 1 car with weekly precision inspections',
  '["One vehicle covered", "4 visits per month (1x/week)", "Complete system checkup", "Detailed diagnostic reports", "Parts recommendation tracking", "Cost-saving analysis", "24/7 emergency support", "Garage visit optimization", "Vehicle health records"]'::jsonb
),
(
  'CarDoc Monthly - 2x/Week',
  'bi_weekly',
  'monthly',
  'cardoc',
  349.99,
  8,
  1,
  'Monthly subscription for 1 car with twice-weekly precision inspections',
  '["One vehicle covered", "8 visits per month (2x/week)", "Complete system checkup", "Detailed diagnostic reports", "Parts recommendation tracking", "Cost-saving analysis", "24/7 emergency support", "Garage visit optimization", "Vehicle health records", "Enhanced monitoring"]'::jsonb
),
(
  'CarDoc Yearly - 1x/Week',
  'weekly',
  'yearly',
  'cardoc',
  2159.88,
  48,
  1,
  'Annual subscription for 1 car with weekly precision inspections (Save 10%)',
  '["One vehicle covered", "~48 visits per year (1x/week)", "Complete system checkup", "Detailed diagnostic reports", "Parts recommendation tracking", "Cost-saving analysis", "24/7 priority support", "Garage visit optimization", "Vehicle health records", "Save 10% vs monthly"]'::jsonb
),
(
  'CarDoc Yearly - 2x/Week',
  'bi_weekly',
  'yearly',
  'cardoc',
  3779.88,
  96,
  1,
  'Annual subscription for 1 car with twice-weekly precision inspections (Save 10%)',
  '["One vehicle covered", "~96 visits per year (2x/week)", "Complete system checkup", "Detailed diagnostic reports", "Parts recommendation tracking", "Cost-saving analysis", "24/7 priority support", "Garage visit optimization", "Vehicle health records", "Enhanced monitoring", "Save 10% vs monthly"]'::jsonb
),

-- AutoDoc Plans (2-3 cars)
(
  'AutoDoc Monthly - 1x/Week',
  'weekly',
  'monthly',
  'autodoc',
  499.99,
  4,
  3,
  'Monthly subscription for 2-3 cars with weekly precision inspections per vehicle',
  '["Up to 3 vehicles covered", "4 visits per month per car (1x/week)", "Priority scheduling", "Advanced diagnostics", "Comprehensive reports", "Priority technician assignment", "Extended warranty coverage", "24/7 VIP support", "Free minor adjustments", "Unlimited consultations", "Fleet management dashboard"]'::jsonb
),
(
  'AutoDoc Monthly - 2x/Week',
  'bi_weekly',
  'monthly',
  'autodoc',
  899.99,
  8,
  3,
  'Monthly subscription for 2-3 cars with twice-weekly precision inspections per vehicle',
  '["Up to 3 vehicles covered", "8 visits per month per car (2x/week)", "Priority scheduling", "Advanced diagnostics", "Comprehensive reports", "Priority technician assignment", "Extended warranty coverage", "24/7 VIP support", "Free minor adjustments", "Unlimited consultations", "Fleet management dashboard", "Enhanced monitoring"]'::jsonb
),
(
  'AutoDoc Yearly - 1x/Week',
  'weekly',
  'yearly',
  'autodoc',
  5399.88,
  48,
  3,
  'Annual subscription for 2-3 cars with weekly precision inspections per vehicle (Save 10%)',
  '["Up to 3 vehicles covered", "~48 visits per year per car (1x/week)", "Priority scheduling", "Advanced diagnostics", "Comprehensive reports", "Priority technician assignment", "Extended warranty coverage", "24/7 VIP support", "Free minor adjustments", "Unlimited consultations", "Fleet management dashboard", "Save 10% vs monthly"]'::jsonb
),
(
  'AutoDoc Yearly - 2x/Week',
  'bi_weekly',
  'yearly',
  'autodoc',
  9719.88,
  96,
  3,
  'Annual subscription for 2-3 cars with twice-weekly precision inspections per vehicle (Save 10%)',
  '["Up to 3 vehicles covered", "~96 visits per year per car (2x/week)", "Priority scheduling", "Advanced diagnostics", "Comprehensive reports", "Priority technician assignment", "Extended warranty coverage", "24/7 VIP support", "Free minor adjustments", "Unlimited consultations", "Fleet management dashboard", "Enhanced monitoring", "Save 10% vs monthly"]'::jsonb
);

-- Update customer_subscriptions to track multiple vehicles per subscription
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_subscriptions' AND column_name = 'vehicle_count'
  ) THEN
    ALTER TABLE customer_subscriptions ADD COLUMN vehicle_count integer DEFAULT 1;
  END IF;
END $$;

-- Add constraint to customer_vehicle_folders to link to subscription
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_vehicle_folders' AND column_name = 'customer_subscription_id'
  ) THEN
    ALTER TABLE customer_vehicle_folders ADD COLUMN customer_subscription_id uuid REFERENCES customer_subscriptions(id);
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_folders_subscription ON customer_vehicle_folders(customer_subscription_id);

-- Add comment explaining the model
COMMENT ON TABLE subscription_plans IS 'CarDoc plans support 1 vehicle, AutoDoc plans support 2-3 vehicles. Billing can be monthly or yearly with 10% discount for yearly.';
