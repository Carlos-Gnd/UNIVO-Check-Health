// CORS_ORIGIN puede ser un único origen o una lista separada por comas
// (p. ej. "https://univo-check-health.netlify.app,https://<app>.vercel.app").
// Si no está configurado, refleja cualquier origen (solo para desarrollo).
const ALLOWED: string[] = (Deno.env.get('CORS_ORIGIN') ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Devuelve las cabeceras CORS para ESTE request, reflejando su Origin cuando está
// en la lista blanca. Por eso recibe el Request: con varios frontends (Netlify +
// Vercel) un valor estático solo dejaría pasar a uno. `Vary: Origin` evita que un
// intermediario cachee la respuesta de un origen y se la sirva a otro.
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow =
    ALLOWED.includes('*') || ALLOWED.includes(origin) ? origin || '*' : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-dispatch-secret',
    'Vary': 'Origin',
  };
}
