/*
  # Fix Auth User Deletion in delete_user_completely Function

  ## Problem
  The delete_user_completely function may not be properly deleting users from auth.users,
  causing "user already registered" errors when trying to recreate accounts.

  ## Solution
  1. Update the function to ensure proper deletion from auth.users
  2. Add better error handling
  3. Use proper search_path to access auth schema
*/

-- Drop and recreate the function with improved auth.users deletion
CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role text;
  deleted_from_profiles integer := 0;
  deleted_from_auth integer := 0;
BEGIN
  -- Check if the caller is an admin
  SELECT role INTO caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Check if user exists in profiles
  IF EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    -- Delete from profiles first (this cascades to all related tables)
    DELETE FROM profiles WHERE id = target_user_id;
    GET DIAGNOSTICS deleted_from_profiles = ROW_COUNT;
    
    IF deleted_from_profiles > 0 THEN
      RAISE NOTICE 'Deleted user % from profiles', target_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'User % does not exist in profiles', target_user_id;
  END IF;

  -- Delete from auth.users (requires SECURITY DEFINER and proper search_path)
  -- This must be done after profiles deletion to avoid foreign key issues
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS deleted_from_auth = ROW_COUNT;
    
    IF deleted_from_auth > 0 THEN
      RAISE NOTICE 'Deleted user % from auth.users', target_user_id;
    ELSE
      RAISE WARNING 'Failed to delete user % from auth.users', target_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'User % does not exist in auth.users', target_user_id;
  END IF;

  -- Return true if at least profiles was deleted (auth.users might already be gone)
  RETURN deleted_from_profiles > 0 OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id);
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete user %: %', target_user_id, SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION delete_user_completely(uuid) TO authenticated;

-- Also create a helper function to clean up orphaned auth users (users in auth.users but not in profiles)
CREATE OR REPLACE FUNCTION cleanup_orphaned_auth_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role text;
  deleted_count integer := 0;
  orphaned_user record;
BEGIN
  -- Check if the caller is an admin
  SELECT role INTO caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can cleanup orphaned users';
  END IF;

  -- Find and delete auth users that don't have profiles
  FOR orphaned_user IN 
    SELECT id FROM auth.users 
    WHERE id NOT IN (SELECT id FROM profiles)
    AND id != auth.uid() -- Don't delete the current admin user
  LOOP
    DELETE FROM auth.users WHERE id = orphaned_user.id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_orphaned_auth_users() TO authenticated;

