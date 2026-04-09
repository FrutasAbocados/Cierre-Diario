# 🥑 Abocados — Control Empresarial

App web para el control financiero diario de la empresa, con sincronización en la nube entre dispositivos.

## ⚡ Stack
- **Frontend**: HTML + CSS + JS vanilla (sin frameworks, sin build)
- **Base de datos**: Supabase (PostgreSQL en la nube + auth + realtime)
- **Caché local**: IndexedDB (para arranque rápido y uso offline básico)
- **Hosting**: Netlify

## 📋 Setup inicial (sólo una vez)

### 1. Crear proyecto en Supabase

1. Ve a https://supabase.com → "Start your project"
2. Inicia sesión con GitHub o email
3. Click en **New Project**:
   - Name: `abocados` (o lo que quieras)
   - Database Password: genera una segura y **guárdala**
   - Region: **West EU (Ireland)** o **Frankfurt**
   - Plan: Free
4. Espera ~2 minutos a que se cree el proyecto

### 2. Crear las tablas

1. En Supabase, menú izquierdo → **SQL Editor**
2. Click en **New query**
3. Copia y pega TODO el contenido del archivo `supabase-schema.sql`
4. Click en **Run** (abajo a la derecha)
5. Deberías ver "Success. No rows returned"

### 3. Habilitar autenticación por email

1. Menú izquierdo → **Authentication** → **Providers**
2. Comprueba que **Email** está habilitado (suele estarlo por defecto)
3. **Importante**: para que no te pida confirmar email cada vez que registras un usuario, ve a **Authentication** → **Sign In / Up** → desactiva **"Confirm email"**. Si lo dejas activado, el primer usuario tendrá que confirmar el email antes de poder entrar.

### 4. Conseguir las claves de API

1. Menú izquierdo → ⚙️ **Project Settings** → **API**
2. Copia **Project URL** (ej: `https://abcdefgh.supabase.co`)
3. Copia **`anon` `public`** key (clave larga que empieza por `eyJ...`)

### 5. Configurar el frontend

1. Abre el archivo `config.js`
2. Pega tu Project URL y anon key:
   ```js
   window.SUPABASE_URL = 'https://abcdefgh.supabase.co';
   window.SUPABASE_ANON_KEY = 'eyJhbG...tu-clave-larga...';
   ```
3. Guarda

### 6. Deploy en Netlify

**Opción A — Netlify desde GitHub (recomendado, deploy automático en cada push):**

1. Sube los archivos a un repo de GitHub
2. En Netlify → **Add new site** → **Import an existing project** → conecta GitHub
3. Selecciona el repo
4. Build settings: déjalo todo en blanco (es estático puro)
5. Deploy

**Opción B — Drag & drop:**

1. Arrastra la carpeta entera a Netlify (Sites → drag&drop)

### 7. Crear tu cuenta de usuario

1. Abre la URL de Netlify
2. Verás la pantalla de login → click en **Registrarse** con tu email y una contraseña
3. Si tenías "Confirm email" activado, recibirás un email de confirmación; haz click y vuelve
4. Entra con email + contraseña
5. Listo

## 🔐 Seguridad

- La clave `anon public` que va en el frontend es segura para exponer; está diseñada para ello.
- La protección real viene de **Row Level Security (RLS)** activada en Supabase: cada usuario solo puede ver/modificar sus propias filas.
- **NUNCA** pongas la clave `service_role` en el frontend.
- Para acceder a tus datos hay que iniciar sesión con email+contraseña.

## 🔄 Cómo funciona la sincronización

- Cada cambio (guardar cierre, añadir deuda, etc.) se escribe primero en IndexedDB local (instantáneo) y después en Supabase (cloud).
- Cuando la app arranca, lee desde Supabase y actualiza la caché local.
- Si abres la app en otro dispositivo, los cambios aparecen en tiempo real (Realtime de Supabase).
- Si pierdes la conexión, la app sigue funcionando con la caché local. Cuando vuelvas a tener conexión, las próximas escrituras se sincronizarán.

## 📦 Estructura de archivos

```
.
├── index.html           ← UI
├── styles.css           ← Estilos
├── config.js            ← Tus claves de Supabase (¡no commitees claves de producción a repos públicos!)
├── app.js               ← Lógica de la app
├── supabase-schema.sql  ← Script SQL para crear tablas (sólo una vez)
├── netlify.toml         ← Config de Netlify
└── README.md
```

## 🛠️ Funciones

- 📝 Cierre del día con cálculos automáticos (margen, IVA, deuda acumulada, ticket medio, comparativa con la media)
- 📈 Dashboard con KPIs y gráficos
- 🔮 Forecast: pronóstico 30 días, run-rate anual/semestral
- 🎯 Objetivos mensual / anual / margen con progreso
- 📋 Historial filtrable
- 📅 Resumen semanal y mensual con variaciones
- 💳 Deudores: seguimiento por cliente
- 🏪 Proveedores: gastos detallados por categoría
- 💼 Sueldos: nóminas, anticipos, descuentos
- ⚙️ Backup JSON/CSV, ajustes (IVA, umbrales, etc.)

## 🆘 Problemas comunes

**"Configuración pendiente"** → No has editado `config.js` con tus claves.

**No me deja registrarme / "Email not confirmed"** → Ve a Supabase → Authentication → Sign In/Up → desactiva "Confirm email", o confirma el email desde tu bandeja.

**Los datos no se sincronizan** → Comprueba el estado del puntito arriba: verde = OK, ámbar = sincronizando, rojo = sin conexión. Pulsa "🔄 Resincronizar desde la nube" en Ajustes.

**Quiero borrar y empezar de cero** → En Ajustes → Zona peligrosa → "BORRAR TODO". Es irreversible.

## 📝 Backup recomendado

Aunque los datos están en la nube, exporta JSON desde Ajustes una vez al mes como copia adicional. Es un único archivo que se descarga y puedes guardar donde quieras.
