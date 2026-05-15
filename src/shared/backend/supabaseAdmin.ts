// Cliente admin con service_role — solo usar en el panel de gestión de usuarios.
// NUNCA exponer este cliente en componentes accesibles a estudiantes.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const serviceRole = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string;

export const supabaseAdmin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});
