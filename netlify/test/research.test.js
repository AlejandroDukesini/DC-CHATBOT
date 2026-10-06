import { afterEach, describe, expect, it, vi } from 'vitest';
import research, { config } from '../functions/research.mjs';

const call = (url, init) => research(new Request(`https://demo.test${url}`, init), { ip: `1.2.3.${Math.random()}` });

afterEach(() => vi.unstubAllGlobals());

describe('función /api/research', () => {
  it('expone la ruta pública', () => {
    expect(config.path).toBe('/api/research');
  });

  it('solo acepta GET', async () => {
    const res = await call('/api/research?q=x', { method: 'POST' });
    expect(res.status).toBe(405);
  });

  it('valida la consulta sin llamar a las fuentes', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const res = await call('/api/research?q=');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Escribe un tema');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('devuelve el resultado y lo marca como cacheable', async () => {
    vi.stubGlobal('fetch', async (url) => ({
      ok: true,
      json: async () =>
        String(url).includes('wikipedia')
          ? { query: { pages: [{ index: 1, title: 'Fotosíntesis', extract: 'La fotosíntesis es la conversión de materia inorgánica en orgánica gracias a la luz.' }] } }
          : {},
    }));
    const res = await call('/api/research?q=fotos%C3%ADntesis');
    expect(res.status).toBe(200);
    expect(res.headers.get('Netlify-CDN-Cache-Control')).toContain('s-maxage');
    expect((await res.json()).sources[0].title).toBe('Fotosíntesis');
  });
});
