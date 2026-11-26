-- ============================================================
-- Run this ONCE in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates a secure server-side function that can delete
-- a judge's auth.users entry. Only admin-role profiles can call it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_judge_auth_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Security: only allow callers with admin role in profiles
  SELECT role INTO caller_role
    FROM public.profiles
   WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only admins can delete judge auth accounts';
  END IF;

  -- Delete the auth user (cascades to profiles via FK ON DELETE CASCADE)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Grant execute to authenticated users (the function itself enforces admin-only)
GRANT EXECUTE ON FUNCTION public.delete_judge_auth_user(uuid) TO authenticated;
