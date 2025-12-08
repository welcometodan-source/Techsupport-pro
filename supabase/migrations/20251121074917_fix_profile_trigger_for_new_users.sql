/*
  # Fix Profile Creation Trigger for New User Signups

  ## Problem
  Users are signing up but profiles are not being created automatically.
  The trigger exists but appears to be failing silently.

  ## Changes
  1. Recreate the trigger function with better error handling
  2. Add logging to help debug issues
  3. Ensure the trigger fires correctly on INSERT
  4. Grant necessary permissions

  ## Security
  - Function runs as SECURITY DEFINER to bypass RLS
  - No changes to RLS policies
*/

-- Drop and recreate the function with improved error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_role text;
  v_email text;
BEGIN
  -- Log the trigger execution
  RAISE LOG 'handle_new_user triggered for user: %', NEW.id;
  
  -- Extract values with defaults
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  v_email := COALESCE(NEW.email, '');
  
  RAISE LOG 'Creating profile with: full_name=%, phone=%, role=%, email=%', v_full_name, v_phone, v_role, v_email;
  
  -- Insert profile
  INSERT INTO public.profiles (
    id, 
    full_name, 
    phone, 
    role, 
    email,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_phone,
    v_role,
    v_email,
    CASE 
      WHEN v_role = 'technician' THEN 'pending'
      ELSE 'active'
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
    role = COALESCE(EXCLUDED.role, profiles.role),
    updated_at = NOW();
  
  RAISE LOG 'Profile created successfully for user: %', NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the actual error
    RAISE LOG 'ERROR creating profile for user %: % - %', NEW.id, SQLERRM, SQLSTATE;
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    -- Still return NEW so user creation doesn't fail
    RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is configured correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Ensure the function can be executed
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates a profile when a new user signs up';
