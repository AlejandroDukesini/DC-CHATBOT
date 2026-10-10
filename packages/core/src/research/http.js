// Manejador HTTP del investigador, independiente del servidor.
// Lo reutilizan la Netlify Function (producción) y el middleware de Vite (desarrollo).

import { isUserError } from '../errors.js';
import { research } from './agent.js';

/** Limitador en memoria por IP. En serverless es "best effort": cada instancia tiene el suyo. */
export function createRateLimiter({ limit = 15, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

export function createResearchHandler({ fetch: fetchFn, contactEmail, rateLimiter = createRateLimiter(), logger = console } = {}) {
  return async function handle({ query, ip = 'unknown' }) {
    if (!rateLimiter(ip)) {
      return { status: 429, body: { error: 'Demasiadas consultas seguidas. Espera un minuto e inténtalo de nuevo.' } };
    }
    try {
      // globalThis.fetch se lee en cada llamada, no al crear el manejador (permite sustituirlo en tests).
      const result = await research(query, { fetch: fetchFn ?? globalThis.fetch, contactEmail });
      return { status: 200, body: result };
    } catch (err) {
      if (isUserError(err)) return { status: 400, body: { error: err.message } };
      logger.error?.('[research] error inesperado', err);
      return { status: 502, body: { error: 'Las fuentes no respondieron. Inténtalo de nuevo en unos segundos.' } };
    }
  };
}
