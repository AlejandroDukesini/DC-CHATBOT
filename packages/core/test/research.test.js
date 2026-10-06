import { describe, expect, it } from 'vitest';
import { createRateLimiter, createResearchHandler, research, researchReply } from '../src/index.js';
import { detectLanguage, keywords, splitSentences } from '../src/research/text.js';

const ES_PAGES = {
  query: {
    pages: [
      {
        index: 1,
        title: 'Agujero negro',
        fullurl: 'https://es.wikipedia.org/wiki/Agujero_negro',
        pageprops: { wikibase_item: 'Q589' },
        extract:
          'Un agujero negro es una región del espacio con una concentración de masa tan elevada que nada puede escapar. ' +
          'La teoría de la relatividad general predice su existencia. ' +
          'Los agujeros negros supermasivos se encuentran en el centro de las galaxias. ' +
          'El horizonte de sucesos marca la frontera de un agujero negro.',
      },
      {
        index: 2,
        title: 'Agujero (desambiguación)',
        pageprops: { disambiguation: '' },
        extract: 'Agujero puede referirse a varias cosas en distintos contextos.',
      },
    ],
  },
};

const WIKIDATA = {
  entities: {
    Q589: {
      labels: { es: { value: 'agujero negro' }, en: { value: 'black hole' } },
      descriptions: { es: { value: 'región del espacio-tiempo de la que nada escapa' } },
    },
  },
};

const CROSSREF = {
  message: {
    items: [
      { DOI: '10.1/a', title: ['Imaging the black hole shadow'], issued: { 'date-parts': [[2019]] }, 'is-referenced-by-count': 900, author: [{ given: 'K.', family: 'Akiyama' }] },
      { DOI: '10.1/b', title: ['Unrelated economics paper'], 'is-referenced-by-count': 5000 },
      { DOI: '10.1/c', title: ['Black hole thermodynamics'], issued: { 'date-parts': [[1975]] }, 'is-referenced-by-count': 1200 },
    ],
  },
};

function mockFetch(routes) {
  const urls = [];
  const fn = async (url, init) => {
    urls.push(url);
    expect(init.headers['User-Agent']).toContain('DC-Chatbot-Research');
    const route = routes.find(([match]) => match(url));
    if (!route) return { ok: true, json: async () => ({}) };
    const body = route[1];
    if (body instanceof Error) throw body;
    return { ok: true, json: async () => body };
  };
  fn.urls = urls;
  return fn;
}

const isWiki = (lang) => (url) => url.startsWith(`https://${lang}.wikipedia.org`) && url.includes('generator=search');
const isWikidata = (url) => url.startsWith('https://www.wikidata.org');
const isCrossref = (url) => url.startsWith('https://api.crossref.org');

describe('texto', () => {
  it('detecta idioma y extrae palabras clave', () => {
    expect(detectLanguage('¿Qué es un agujero negro?')).toBe('es');
    expect(detectLanguage('what is a black hole')).toBe('en');
    expect(keywords('¿Qué es un agujero negro?')).toEqual(['agujero', 'negro']);
  });

  it('divide frases sin cortar decimales', () => {
    expect(splitSentences('El valor de pi es 3.14 aproximadamente en geometría. Otra frase más con contenido suficiente.')).toHaveLength(2);
  });
});

describe('agente investigador', () => {
  it('resume con fuentes, contraste en Wikidata y literatura académica', async () => {
    const fetch = mockFetch([[isWiki('es'), ES_PAGES], [isWikidata, WIKIDATA], [isCrossref, CROSSREF]]);
    const r = await research('¿qué es un agujero negro?', { fetch });

    expect(r.answer.startsWith('Un agujero negro es una región')).toBe(true);
    expect(r.answer).not.toContain('desambiguación');
    expect(r.sources).toEqual([expect.objectContaining({ title: 'Agujero negro', verification: 'Contrastado con Wikidata Q589' })]);
    // Crossref se consulta con la etiqueta inglesa y solo quedan títulos relevantes, ordenados por citas.
    expect(fetch.urls.find(isCrossref)).toContain('query.bibliographic=black+hole');
    expect(r.references.map((x) => x.doi)).toEqual(['10.1/c', '10.1/a']);
    expect(r.confidenceLabel).toBe('alta');
    expect(r.steps.length).toBeGreaterThanOrEqual(4);
  });

  it('cada frase de la respuesta existe literalmente en la fuente', async () => {
    const fetch = mockFetch([[isWiki('es'), ES_PAGES], [isWikidata, WIKIDATA], [isCrossref, CROSSREF]]);
    const r = await research('agujero negro', { fetch });
    for (const h of r.highlights) expect(ES_PAGES.query.pages[0].extract).toContain(h.text);
  });

  it('reformula en otro idioma si no encuentra nada y vuelve al idioma del usuario vía Wikidata', async () => {
    const enPages = { query: { pages: [{ index: 1, title: 'Black hole', pageprops: { wikibase_item: 'Q589' }, extract: 'A black hole is a region of spacetime where gravity is so strong that nothing can escape.' }] } };
    const fetch = mockFetch([
      [isWiki('es'), { query: { pages: [] } }],
      [isWiki('en'), enPages],
      [(u) => isWikidata(u) && u.includes('sitelinks'), { entities: { Q589: { sitelinks: { eswiki: { title: 'Agujero negro' } } } } }],
      [(u) => u.startsWith('https://es.wikipedia.org') && u.includes('titles='), ES_PAGES],
      [isWikidata, WIKIDATA],
      [isCrossref, CROSSREF],
    ]);
    const r = await research('agujero negro', { fetch });
    expect(r.sources[0].title).toBe('Agujero negro');
    expect(r.steps.some((s) => s.includes('salté a su versión en es'))).toBe(true);
  });

  it('sigue funcionando si Crossref y Wikidata fallan', async () => {
    const fetch = mockFetch([[isWiki('es'), ES_PAGES], [isWikidata, new Error('caído')], [isCrossref, new Error('caído')]]);
    const r = await research('agujero negro', { fetch });
    expect(r.answer).toBeTruthy();
    expect(r.references).toEqual([]);
    expect(r.sources[0].verification).toBe('Sin contraste en Wikidata');
  });

  it('devuelve "sin datos" cuando ninguna fuente tiene el tema', async () => {
    const fetch = mockFetch([[(u) => u.includes('wikipedia'), { query: { pages: [] } }], [isCrossref, { message: { items: [] } }]]);
    const r = await research('xyzzqq plorf', { fetch });
    expect(r.answer).toBeNull();
    expect(researchReply(r).embeds[0].title).toContain('Sin resultados');
  });

  it('rechaza consultas vacías o demasiado largas', async () => {
    await expect(research(' ', { fetch: mockFetch([]) })).rejects.toThrow('Escribe un tema');
    await expect(research('a'.repeat(201), { fetch: mockFetch([]) })).rejects.toThrow('demasiado larga');
  });
});

describe('manejador HTTP', () => {
  it('responde 400 con mensajes de validación y 200 con resultados', async () => {
    const handle = createResearchHandler({ fetch: mockFetch([[isWiki('es'), ES_PAGES]]), logger: {} });
    expect((await handle({ query: '' })).status).toBe(400);
    const ok = await handle({ query: 'agujero negro' });
    expect(ok.status).toBe(200);
    expect(ok.body.answer).toBeTruthy();
  });

  it('limita las consultas por IP', async () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect([limiter('a'), limiter('a'), limiter('a'), limiter('b')]).toEqual([true, true, false, true]);
    t = 1001;
    expect(limiter('a')).toBe(true);
  });

  it('no expone errores internos', async () => {
    const handle = createResearchHandler({
      fetch: async () => {
        throw new Error('secreto interno');
      },
      logger: { error: () => {} },
    });
    const res = await handle({ query: 'agujero negro' });
    expect(JSON.stringify(res.body)).not.toContain('secreto');
  });
});
