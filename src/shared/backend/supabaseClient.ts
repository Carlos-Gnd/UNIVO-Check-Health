import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// #1: la sesión se persiste en sessionStorage (no localStorage), de modo que se
// cierra al cerrar el navegador/pestaña. El cierre por inactividad (idle-timeout)
// se maneja en MainLayout. autoRefreshToken sigue activo para que la sesión no
// expire a mitad de uso activo dentro de la misma pestaña.
const authStorage = typeof window !== 'undefined' ? window.sessionStorage : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
