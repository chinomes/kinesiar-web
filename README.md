# KINESIAR

Sitio web estático publicado con GitHub Pages y conectado a Supabase para solicitudes
de turno, administración del calendario, contenido, contacto y galería.

## Activar Supabase

1. En Supabase, abrí **SQL Editor** y ejecutá el contenido completo de
   [`supabase/migrations/20260101000000_kinesiar_schema.sql`](supabase/migrations/20260101000000_kinesiar_schema.sql).
2. En **Authentication → Users**, creá una cuenta administradora con correo y
   contraseña. Supabase Auth no permite iniciar sesión solo con un nombre de usuario.
3. Copiá el UUID de esa cuenta y ejecutá en SQL Editor:

   ```sql
   insert into public.kinesiar_admins (user_id)
   values ('PEGAR-ACA-EL-UUID-DEL-USUARIO');
   ```

4. Abrí el sitio HTTPS y usá ese correo y contraseña en **Acceso administrador**.

La URL y la clave publishable están en `js/supabase-config.js`. Esa clave está
diseñada para ser pública; las políticas RLS restringen el acceso a los datos.
Nunca publiques una clave `service_role`/secret ni una contraseña de Supabase.

Más detalles en [`README.txt`](README.txt).
