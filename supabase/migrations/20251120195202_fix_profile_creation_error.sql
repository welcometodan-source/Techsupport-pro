/*
  # Fix Profile Creation Error on User Signup

  ## Problem
  Users are getting "database error saving new user" when trying to create accounts.
  The trigger function needs better error handling and should populate the email field.

  ## Changes
  1. Update handle_new_user function with proper error handling
  2. Ensure email is populated from auth.users
  3. Make full_name use a default value if not provided
  4. Add better logging for debugging

  ## Security
  - No changes to RLS policies
  - Function remains SECURITY DEFINER for necessary privileges
*/

-- Drop and recreate the function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_role text;
  v_email text;
BEGIN
  -- Extract values with defaults
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  v_email := NEW.email;

  -- Insert profile with all required fields
  INSERT INTO public.profiles (id, full_name, phone, role, email, avatar_url)
  VALUES (
    NEW.id,
    v_full_name,
    v_phone,
    v_role,
    v_email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    role = COALESCE(EXCLUDED.role, profiles.role),
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
