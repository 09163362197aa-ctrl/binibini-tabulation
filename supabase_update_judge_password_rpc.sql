-- ============================================================
-- Run this ONCE in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates a secure server-side function so Admins can reset a judge's
-- login password directly in auth.users. Only admin-role profiles can call it.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_update_judge_password(
  target_user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Security: only allow callers with admin role in profiles
  SELECT role INTO caller_role
    FROM public.profiles
   WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only admins can update judge passwords';
  END IF;

  IF new_password IS NULL OR length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE auth.users
     SET encrypted_password = crypt(new_password, gen_salt('bf')),
         updated_at = now()
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Judge auth user not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_judge_password(uuid, text) TO authenticated;
