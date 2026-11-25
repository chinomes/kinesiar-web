KINESIAR WEB — PRIMERA MAQUETA VISUAL

IDENTIDAD Y DISEÑO
- Paleta principal naranja y blanco, con texto oscuro para facilitar la lectura.
- Video vertical ubicado a un costado del contenido en computadora; en celulares pasa debajo del texto.
- Tarjetas de presentación flotantes con giro 3D: al pasar el cursor muestran el reverso y en pantallas táctiles se giran al tocarlas.
- Menú circular con el logotipo: se despliega al pasar el cursor o al tocarlo.
- Diseño adaptable a computadora, tablet y celular.

ARCHIVOS PRINCIPALES
- index.html: estructura de la página.
- css/estilos.css: diseño, colores, animaciones y adaptación a pantallas.
- js/funciones.js: menú, tarjetas giratorias, validación de formularios y panel de demostración.
- assets/video/fondo.mp4: video vertical recibido, reproducido sin sonido y en bucle.
- assets/img/logo-kinesiar.png: logotipo extraído de las imágenes proporcionadas.
- assets/img/referencias/: capturas incluidas en el ZIP original para seleccionar recursos después.

CÓMO ABRIR
1. Descomprimí KINESIAR-WEB.zip.
2. Abrí index.html con Chrome, Edge o Firefox.
3. Para editar el proyecto, abrí la carpeta KINESIAR-WEB en Visual Studio Code.
4. Para probar los cambios, actualizá la pestaña del navegador. También podés utilizar la extensión Live Server.

QUÉ FUNCIONA
- Formulario de solicitud con validación; las fechas que el administrador bloquea no aceptan nuevas solicitudes.
- Panel con listado de solicitudes, cambio de estado (Pendiente, Confirmado o Cancelado) y edición de fecha/franja horaria.
- Calendario mensual interactivo: muestra las solicitudes por día, permite revisar cada fecha y bloquearla o volver a habilitarla.
- Edición del título y presentación de inicio, los textos de turnos, y los nombres/descripciones de los tres servicios.
- Edición de contacto (WhatsApp, teléfono, correo, dirección, ciudad, redes sociales, web, horarios y texto introductorio).
- Las solicitudes, los bloqueos y los cambios de página/contacto se guardan localmente y se actualizan entre pestañas del mismo navegador y origen.
- El panel verifica el acceso inicial con PBKDF2 y no guarda la contraseña en texto plano. Usá el usuario y la contraseña iniciales definidos para este sitio.

LÍMITES IMPORTANTES: NO HAY SERVIDOR NI BASE DE DATOS
- La autenticación ocurre en el navegador. El verificador de contraseña está incluido en el sitio y puede inspeccionarse o atacarse fuera de línea; no protege un sitio publicado ni datos sensibles. Para proteger el panel de verdad hace falta autenticación en servidor y autorización del lado del servidor.
- Las solicitudes y ediciones se guardan solo en el navegador y origen donde se cargaron. No se reciben avisos y no se comparten con otros dispositivos o navegadores.
- “Confirmado” es el estado que asigna el administrador; enviar el formulario solo crea una solicitud pendiente, no reserva ni confirma un turno en una agenda central.
- Las imágenes cargadas se muestran durante la sesión actual; no se suben a un servidor.
- Para ofrecer turnos públicos reales hay que conectar una base de datos, un backend con validación de disponibilidad y un sistema de autenticación seguro.
- Para que el almacenamiento del navegador sea consistente, abrí la página desde un servidor local (por ejemplo Live Server) o desde el hosting HTTPS, no como archivo suelto.

VIDEO
El video se ve vertical a la derecha en computadora y debajo del contenido principal en celular. El archivo recibido conserva textos e iconos superpuestos de la interfaz de Reels. Para una presentación más profesional, se recomienda reemplazarlo por una exportación limpia del video, sin interfaz de Instagram.

ADMINISTRACIÓN
- Abrí “Acceso administrador” e ingresá las credenciales iniciales entregadas para el sitio.
- En “Calendario”, seleccioná un día para revisar sus solicitudes y cambiar su disponibilidad. Bloquear un día impide solicitudes nuevas, pero no cancela las que ya llegaron. En “Turnos”, también podés reprogramar la fecha y franja horaria de una solicitud.
- En “Turnos”, cambiá el estado de cada solicitud. La confirmación debe coordinarse manualmente con la persona.
- En “Contenido” y “Contacto”, editá los textos públicos y los datos del consultorio y guardalos. Los cambios se reflejan en esta página.
