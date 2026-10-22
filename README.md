# Mi Negocio — Inventario, Compras y Ventas (Supabase + GitHub Pages)

App web móvil de una sola pantalla. Base de datos **relacional PostgreSQL en Supabase**
(5 tablas con llaves foráneas), pantalla en HTML + Tailwind, publicada gratis en **GitHub Pages**.

> **Por qué ya no hay PHP:** Supabase no ejecuta PHP; ofrece base de datos PostgreSQL, login y una API.
> Por eso la lógica que estaba en `api.php` ahora vive en dos funciones SQL dentro de la base de datos
> (`registrar_venta` y `registrar_compra`) y la pantalla habla directo con Supabase. Los mismos botones,
> las mismas tablas, el mismo comportamiento. La versión con XAMPP + PHP sigue sirviendo para uso local.

## Contenido

```
inventario-supabase/
├── index.html          # pantalla única móvil
├── app.js              # lógica (login, formularios, movimientos)
├── config.js           # ← AQUÍ pegas tu URL y clave pública de Supabase
├── supabase/
│   └── schema.sql      # tablas, seguridad (RLS), funciones y vista de movimientos
├── .gitignore
└── README.md
```

---

## PARTE A — Supabase (base de datos y login)

> Supabase cambia sus menús de vez en cuando: si un nombre no coincide exactamente, busca el más parecido.

### 1. Crear el proyecto
1. Entra a https://supabase.com → **Start your project** → inicia sesión (con GitHub o con tu correo).
2. **New project** → elige nombre (ej. `mi-negocio`), una **contraseña de base de datos** (guárdala) y la región más cercana.
3. Espera 1–2 minutos a que termine de crearse.

### 2. Crear las tablas
1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abre `supabase/schema.sql`, copia **todo** el contenido, pégalo y pulsa **Run**.
3. Debe decir *Success. No rows returned*.
4. Comprueba en **Table Editor**: aparecen `clientes`, `proveedores`, `productos`, `compras` y `ventas`.

### 3. Copiar tus claves a `config.js`
1. En tu proyecto de Supabase pulsa el botón **Connect** (arriba): ahí ves la **Project URL** (`https://xxxx.supabase.co`).
2. Ve a **Settings → API Keys** y copia la **Publishable key** (`sb_publishable_...`).
   Si tu proyecto todavía muestra la clave antigua **anon**, también sirve.
3. Abre `config.js` y reemplaza:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'sb_publishable_xxxxxxxx',
   ```
   Es seguro subir esta clave a GitHub: es pública y los datos los protege la seguridad por filas (RLS) del `schema.sql`.
   **Nunca** pegues la clave `service_role` ni la `secret`.

### 4. Configurar el login
- **Authentication → Sign In / Providers → Email**: deja **Email** activado.
  Para entrar sin confirmar el correo, desactiva **Confirm email**. Si lo dejas activado, al crear tu cuenta
  te llega un correo con un enlace que debes abrir antes de entrar.

### 5. Probar en tu PC antes de subir
Con XAMPP: copia la carpeta a `C:\xampp\htdocs\mi-negocio`, enciende Apache y abre
`http://localhost/mi-negocio`. (Si no, desde la carpeta: `python -m http.server 8000` y abre `http://localhost:8000`.)

1. Pulsa **No tengo cuenta: crear una**, escribe tu correo y una contraseña (mín. 6 caracteres).
2. Registra en este orden: **Proveedor → Cliente → Producto (con stock inicial)**.
3. Haz una **Compra** (suma stock) y una **Venta** (resta stock) y mira **Movimientos**.

### 6. Cerrar el registro de usuarios (muy importante)
Cuando tu app esté publicada, cualquiera con el enlace podría crear una cuenta (aunque no vería tus datos).
Como es un solo negocio, apágalo después de crear tu cuenta:
**Authentication → Sign In / Providers**, en la sección de registros de usuarios, desactiva
**Allow new users to sign up**. Los usuarios que ya existen siguen pudiendo entrar.
Si luego necesitas otro usuario: **Authentication → Users → Add user**.

---

## PARTE B — GitHub (guardar el proyecto y publicarlo)

### 1. Preparación (una sola vez)
1. Crea tu cuenta en https://github.com.
2. Instala **Git**: https://git-scm.com/download/win (todo por defecto).
3. Abre una terminal (Git Bash, PowerShell o CMD) y presenta tu identidad:
   ```bash
   git config --global user.name  "Tu Nombre"
   git config --global user.email "tu-correo@gmail.com"
   ```

### 2. Crear el repositorio vacío
1. En GitHub: botón **+** (arriba a la derecha) → **New repository**.
2. Nombre: `mi-negocio`. Déjalo **Public** (GitHub Pages gratis lo requiere).
3. **No** marques "Add a README" ni ".gitignore" (ya los trae el proyecto). → **Create repository**.

### 3. Subir el proyecto
En la terminal, entra a la carpeta del proyecto (la que tiene `index.html`) y ejecuta,
cambiando `TU-USUARIO` por tu usuario de GitHub:
```bash
cd C:\ruta\a\inventario-supabase
git init
git add .
git commit -m "Primera versión de Mi Negocio"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mi-negocio.git
git push -u origin main
```
La primera vez se abre una ventana del navegador para iniciar sesión en GitHub. Actualiza la página del
repositorio y verás tus archivos.

*Alternativa sin terminal:* en el repositorio vacío pulsa **uploading an existing file** y arrastra los
archivos (`index.html`, `app.js`, `config.js`, la carpeta `supabase`, etc.) → **Commit changes**.

### 4. Publicar con GitHub Pages
1. En el repositorio: **Settings → Pages**.
2. En **Build and deployment → Source** elige **Deploy from a branch**.
3. **Branch**: `main` y carpeta `/ (root)` → **Save**.
4. Espera 1–2 minutos y recarga: arriba aparece tu dirección, parecida a
   `https://TU-USUARIO.github.io/mi-negocio/`.

### 5. Avisar a Supabase de la nueva dirección
**Authentication → URL Configuration**:
- **Site URL**: `https://TU-USUARIO.github.io/mi-negocio/`
- **Redirect URLs**: agrega la misma dirección.

(Sin esto, los enlaces del correo de confirmación apuntarían a `localhost`.)

### 6. Usarla en el celular
Abre esa dirección en Chrome o Safari e inicia sesión.
- Android: menú ⋮ → **Agregar a pantalla de inicio**.
- iPhone: **Compartir → Agregar a inicio**.

Funciona desde cualquier lugar, con Wi-Fi o datos móviles, sin dejar encendida tu PC.

### 7. Subir cambios futuros
Cada vez que modifiques archivos:
```bash
git add .
git commit -m "Describe el cambio"
git push
```
GitHub Pages se actualiza solo en 1–2 minutos (recarga con Ctrl + F5 en el navegador, o cierra y abre la pestaña en el celular).

---

## Cómo funciona

| Tabla | Relaciones |
|---|---|
| `clientes`, `proveedores` | independientes |
| `productos` | `proveedor_id` → `proveedores` (si se borra el proveedor queda en blanco) |
| `compras` | `proveedor_id` → `proveedores`, `producto_id` → `productos` (RESTRICT) |
| `ventas` | `cliente_id` → `clientes`, `producto_id` → `productos` (RESTRICT) |

- **Inventario:** `registrar_venta` resta el stock y `registrar_compra` lo suma, cada una en **una transacción**
  (`SELECT … FOR UPDATE`): no queda nada a medias y no se puede vender más del stock, ni con dos celulares a la vez.
- **Fecha y hora:** `fecha_hora` se guarda con `now()` en el servidor (exacta, no depende del celular).
  Se muestra en la zona `America/La_Paz` (cámbiala en `config.js`).
- **Seguridad:** cada fila lleva el `user_id` de su dueño y las políticas RLS hacen que cada cuenta vea solo lo suyo.
- **Movimientos:** la vista `vw_movimientos` une ventas y compras con producto, cliente y proveedor; el botón
  muestra los últimos 120 (`MOVIMIENTOS_LIMIT` en `config.js`).

## Opcional: login con Google
1. Supabase → **Authentication → Sign In / Providers → Google** → sigue las instrucciones para crear el
   ID de cliente en Google Cloud (la *Authorized redirect URI* es la que Supabase te muestra).
2. En `config.js` pon `GOOGLE_LOGIN: true`, sube el cambio con `git push`.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| Pantalla "Falta configurar Supabase" | Pega tu URL y clave en `config.js` y sube el cambio |
| `Invalid API key` | La clave está mal copiada o incompleta |
| `Could not find the table …` / `relation … does not exist` | No se ejecutó `supabase/schema.sql` completo |
| `Email not confirmed` | Abre el enlace del correo, o desactiva **Confirm email** (paso A4) |
| "El registro de cuentas nuevas está desactivado" | Lo apagaste (paso A6); crea el usuario en **Authentication → Users → Add user** |
| La página no cambia tras `git push` | Espera 1–2 min y recarga con Ctrl + F5 |
| Sin diseño (texto sin estilos) | Falta internet: la app carga Tailwind y Supabase desde una CDN |
| La app deja de responder tras semanas sin uso | En el plan gratuito Supabase puede **pausar** proyectos inactivos; entra a su panel y pulsa **Restore** |
| Olvidé mi contraseña | Supabase → **Authentication → Users**: envía una recuperación o crea otro usuario |

## Respaldos
Supabase → **Table Editor** → abre cada tabla → **Export** (CSV). Hazlo de vez en cuando; en el plan
gratuito no cuentes con copias automáticas descargables.
