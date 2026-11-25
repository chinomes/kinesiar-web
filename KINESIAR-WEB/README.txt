KINESIAR WEB — SITIO CON TURNOS Y ADMINISTRACIÓN

ARCHIVOS PRINCIPALES
- index.html: página y formularios públicos.
- css/estilos.css: diseño adaptable a computadora, tablet y celular.
- js/funciones.js: turnos, calendario, administración, autenticación y almacenamiento.
- js/supabase-config.js: URL del proyecto Supabase y clave publishable.
- supabase/migrations/: tablas, permisos RLS y bucket de imágenes.
- assets/: imágenes y video usados por el sitio.

CONFIGURACIÓN INICIAL DE SUPABASE
1. Abrí el proyecto de Supabase vinculado al sitio.
2. Entrá en SQL Editor > New query.
3. Copiá y ejecutá el contenido completo de:
   supabase/migrations/20260101000000_kinesiar_schema.sql
4. En Authentication > Users, creá el usuario que usarás como administrador.
   Supabase Auth requiere correo electrónico y contraseña; no admite iniciar sesión
   directamente con un nombre de usuario como "cucha2026".
5. Copiá el UUID de ese usuario desde Authentication > Users. En SQL Editor ejecutá
   lo siguiente y reemplazá el texto de ejemplo por el UUID real:

   insert into public.kinesiar_admins (user_id)
   values ('PEGAR-ACA-EL-UUID-DEL-USUARIO');

6. Publicá/actualizá los archivos del repositorio y abrí el sitio desde su URL HTTPS.
7. En “Acceso administrador”, ingresá el correo y la contraseña que creaste en
   Supabase Auth. No compartas la contraseña con nadie ni la incluyas en archivos.

La URL y la clave publishable del proyecto están en js/supabase-config.js. La clave
publishable está diseñada para usarse en el navegador; la seguridad depende de las
políticas RLS de la migración. Nunca agregues al sitio, al repositorio ni a GitHub una
clave secret/service_role ni la contraseña de la base de datos.

FUNCIONES
- Las solicitudes de turno se guardan en Supabase con estado Pendiente.
- El administrador puede consultar solicitudes, cambiar su estado y reprogramar
  fecha y franja horaria.
- El calendario permite bloquear y habilitar días. Los bloqueos se verifican en
  Supabase al insertar una solicitud, además de mostrarse en el sitio.
- El administrador puede editar textos públicos y datos de contacto.
- Las opiniones se guardan como Pendientes para revisión administrativa.
- Las imágenes de la galería se almacenan en el bucket público kinesiar-gallery;
  únicamente las cuentas autorizadas pueden subirlas o eliminarlas.
- La publishable key puede ser visible. El acceso a datos personales y las
  modificaciones administrativas están protegidos por RLS y autenticación.

LÍMITES Y NOTAS
- La configuración, el esquema y el usuario administrador deben estar creados en
  Supabase antes de que los formularios y el panel funcionen.
- Las opiniones se reciben y pueden revisarse desde el panel, pero esta versión no
  las publica automáticamente en la página.
- Las solicitudes son pedidos pendientes; no se envían notificaciones ni se
  confirma automáticamente la disponibilidad con la persona.
- Los datos que existían en localStorage en una versión anterior no se migran
  automáticamente a Supabase.
- Para publicar cambios en GitHub Pages, subí los archivos actualizados a la rama y
  carpeta configuradas para Pages. Los visitantes necesitan recargar la página.

DISEÑO
- Paleta naranja, blanco y texto oscuro.
- Menú circular y tarjetas de servicios interactivas.
- Video vertical en escritorio y versión adaptable para móviles.
