-- Verificar email manualmente
UPDATE auth.users
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email = 'deligober@gmail.com';
