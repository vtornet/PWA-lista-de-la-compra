-- ============================================
-- FIX: Corregir política RLS y añadir columnas necesarias
-- ============================================

-- 1. Añadir columnas si no existen
ALTER TABLE public.list_members ADD COLUMN IF NOT EXISTS list_name TEXT;
ALTER TABLE public.list_members ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Modificar política SELECT para permitir ver todas las membresías
DROP POLICY IF EXISTS "Users can view list memberships" ON public.list_members;

CREATE POLICY "Users can view list memberships"
ON public.list_members FOR SELECT
TO authenticated
USING (true);

-- 3. Modificar política INSERT para permitir crear invitaciones
DROP POLICY IF EXISTS "Users can create list membership" ON public.list_members;

CREATE POLICY "Users can create list membership"
ON public.list_members FOR INSERT
TO authenticated
WITH CHECK (true);
