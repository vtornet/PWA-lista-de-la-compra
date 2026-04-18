-- ============================================
-- CONFIGURACIÓN COMPLETA DE SUPABASE
-- ============================================

-- 1. Habilitar RLS en todas las tablas necesarias
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.items ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view list memberships" ON public.list_members;
DROP POLICY IF EXISTS "Users can create list membership" ON public.list_members;
DROP POLICY IF EXISTS "Users can update list membership" ON public.list_members;
DROP POLICY IF EXISTS "Users can delete list membership" ON public.list_members;

-- 3. Crear políticas para la tabla profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Crear políticas para list_members
CREATE POLICY "Users can view list memberships"
ON public.list_members FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create list membership"
ON public.list_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update list membership"
ON public.list_members FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete list membership"
ON public.list_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Crear políticas para items (si la tabla existe)
-- Estas políticas permiten a usuarios ver items de sus listas
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'items') THEN
        -- Eliminar políticas existentes
        DROP POLICY IF EXISTS "Users can view items" ON public.items;
        DROP POLICY IF EXISTS "Users can create items" ON public.items;
        DROP POLICY IF EXISTS "Users can update items" ON public.items;
        DROP POLICY IF EXISTS "Users can delete items" ON public.items;
        
        -- Crear nuevas políticas
        CREATE POLICY "Users can view items"
        ON public.items FOR SELECT
        TO authenticated
        USING (true); -- Todos pueden ver items (se puede restringir más tarde
        
        CREATE POLICY "Users can create items"
        ON public.items FOR INSERT
        TO authenticated
        WITH CHECK (true);
        
        CREATE POLICY "Users can update items"
        ON public.items FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
        
        CREATE POLICY "Users can delete items"
        ON public.items FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END $$;

-- 6. Verificar configuración
SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    'Policies: ' || count(policy_name) as policies_count
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'list_members', 'items')
GROUP BY tablename, rowsecurity;
