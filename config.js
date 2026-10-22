/**
 * config.js — Ajustes de la app. ES SEGURO subir este archivo a GitHub:
 * la clave "anon" (o "publishable") de Supabase es pública por diseño; lo que protege
 * tus datos son las políticas RLS de supabase/schema.sql.
 *
 * ⚠️ NUNCA pegues aquí la clave "service_role" ni la "secret": esa sí da acceso total.
 *
 * Dónde copiar los dos valores (Supabase, dentro de tu proyecto):
 *   - Project URL → botón "Connect" (arriba, en tu proyecto)           → SUPABASE_URL
 *   - Clave pública → Settings → API Keys → "Publishable key" (sb_publishable_...)
 *     (si tu proyecto aún muestra la antigua "anon" key, también sirve)  → SUPABASE_ANON_KEY
 */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://dxdtelvogdjbdluwdkps.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_XVpLNye0Y74YxbS4Hw_7Ew_byy_lOuv',

  APP_NAME: 'Mi Negocio',
  CURRENCY: 'Bs ',                  // símbolo de moneda
  TIMEZONE: 'America/La_Paz',       // zona horaria para fechas y "ventas de hoy"
  LOW_STOCK_LIMIT: 5,               // stock <= este valor = alerta roja
  MOVIMIENTOS_LIMIT: 120,           // cuántos movimientos muestra el botón "Movimientos"

  // Pon true solo si activaste Google en Supabase → Authentication → Providers
  GOOGLE_LOGIN: false,
};
