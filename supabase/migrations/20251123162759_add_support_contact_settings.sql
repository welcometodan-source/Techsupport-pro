/*
  # Add Support Contact Settings

  1. New Settings
    - Insert default support contact settings into admin_settings table
    - Settings include:
      - support_phone: Customer support phone number
      - support_email: Customer support email address  
      - support_country: Business location country
      - support_city: Business location city
      - support_hours: Business hours description

  2. Notes
    - Uses existing admin_settings table structure
    - Settings can be updated by admins through Admin Settings page
    - Values will be displayed on Customer Care/Support page
*/

-- Insert default support contact settings
INSERT INTO admin_settings (setting_key, setting_value, description)
VALUES
  ('support_phone', '+971525277492', 'Customer support phone number displayed on contact page'),
  ('support_email', 'support@autosupportpro.com', 'Customer support email address'),
  ('support_country', 'United Arab Emirates', 'Business location country'),
  ('support_city', 'Dubai', 'Business location city'),
  ('support_hours', '24/7', 'Business hours description (e.g., "24/7" or "Mon-Fri: 9AM-6PM")')
ON CONFLICT (setting_key) DO NOTHING;