// GET /api/research?q=agujero+negro
// Ejecuta el mismo agente investigador que usa el bot (packages/core). Sin claves ni base de datos.

import { QUERY_MAX, createResearchHandler } from '../../packages/core/src/index.js';

const handle = createResearchHandler({ contactEmail: process.env.RESEARCH_CONTACT_EMAIL });

const json = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...extraHeaders },
  });

export default async function research(req, context) {
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido' }, { Allow: 'GET' });
  const query = new URL(req.url).searchParams.get('q') ?? '';
  if (query.length > QUERY_MAX * 2) return json(400, { error: 'Consulta demasiado larga.' });

  const { status, body } = await handle({ query, ip: context?.ip ?? 'unknown' });
  // Las respuestas correctas se cachean en la CDN: misma consulta, cero coste adicional.
  const cache = status === 200 ? { 'Netlify-CDN-Cache-Control': 'public, s-maxage=86400, durable', 'Cache-Control': 'public, max-age=300' } : { 'Cache-Control': 'no-store' };
  return json(status, body, cache);
}

export const config = { path: '/api/research' };
