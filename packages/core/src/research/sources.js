// Fuentes verificables que consulta el investigador. Todas son APIs públicas,
// gratuitas y sin clave: Wikipedia (enciclopedia con citas), Wikidata (datos
// estructurados con referencias) y Crossref (registro oficial de DOIs académicos).

const REPO = 'https://github.com/AlejandroDukesini/DC-CHATBOT';

export function userAgent(contactEmail) {
  return `DC-Chatbot-Research/1.0 (${REPO}${contactEmail ? `; ${contactEmail}` : ''})`;
}

export async function fetchJson(fetchFn, url, { timeoutMs = 6000, contactEmail } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': userAgent(contactEmail) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).hostname}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const toPage = (p, lang) => ({
  title: p.title,
  url: p.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
  text: p.extract,
  wikidataId: p.pageprops?.wikibase_item ?? null,
  lang,
});

const PAGE_PROPS = {
  prop: 'extracts|info|pageprops',
  exintro: '1',
  explaintext: '1',
  inprop: 'url',
  ppprop: 'wikibase_item|disambiguation',
  redirects: '1',
  format: 'json',
  formatversion: '2',
};

const usable = (p) => p.extract && !(p.pageprops && 'disambiguation' in p.pageprops);

/** Búsqueda + introducciones de artículos en una sola petición (generator=search). */
export async function searchWikipedia(fetchFn, query, lang, opts) {
  const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query, gsrlimit: '4', exlimit: '4', ...PAGE_PROPS });
  const data = await fetchJson(fetchFn, `https://${lang}.wikipedia.org/w/api.php?${params}`, opts);
  return (data.query?.pages ?? [])
    .filter(usable)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .slice(0, 3)
    .map((p) => toPage(p, lang));
}

/** Introducción de un artículo concreto por título. */
export async function wikipediaPage(fetchFn, title, lang, opts) {
  const params = new URLSearchParams({ action: 'query', titles: title, ...PAGE_PROPS });
  const data = await fetchJson(fetchFn, `https://${lang}.wikipedia.org/w/api.php?${params}`, opts);
  const page = (data.query?.pages ?? []).find(usable);
  return page ? toPage(page, lang) : null;
}

/** Título del mismo artículo en otro idioma, usando los enlaces entre wikis de Wikidata. */
export async function wikidataSitelink(fetchFn, id, lang, opts) {
  const params = new URLSearchParams({ action: 'wbgetentities', ids: id, props: 'sitelinks', sitefilter: `${lang}wiki`, format: 'json' });
  const data = await fetchJson(fetchFn, `https://www.wikidata.org/w/api.php?${params}`, opts);
  return data.entities?.[id]?.sitelinks?.[`${lang}wiki`]?.title ?? null;
}

export async function wikidataDescriptions(fetchFn, ids, lang, opts) {
  if (!ids.length) return {};
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels|descriptions',
    languages: lang === 'en' ? 'en' : `${lang}|en`,
    format: 'json',
  });
  const data = await fetchJson(fetchFn, `https://www.wikidata.org/w/api.php?${params}`, opts);
  const out = {};
  for (const [id, entity] of Object.entries(data.entities ?? {})) {
    const description = entity.descriptions?.[lang]?.value ?? entity.descriptions?.en?.value;
    const label = entity.labels?.[lang]?.value ?? entity.labels?.en?.value;
    const labelEn = entity.labels?.en?.value ?? null;
    if (description) out[id] = { id, label, labelEn, description, url: `https://www.wikidata.org/wiki/${id}` };
  }
  return out;
}

export async function searchCrossref(fetchFn, query, opts) {
  const params = new URLSearchParams({
    'query.bibliographic': query,
    rows: '10',
    filter: 'type:journal-article',
    select: 'DOI,title,author,issued,container-title,is-referenced-by-count',
  });
  if (opts?.contactEmail) params.set('mailto', opts.contactEmail);
  const data = await fetchJson(fetchFn, `https://api.crossref.org/works?${params}`, opts);
  return (data.message?.items ?? [])
    .filter((item) => item.title?.[0] && item.DOI)
    .map((item) => ({
      title: item.title[0].replace(/<[^>]+>/g, ''),
      authors: (item.author ?? []).slice(0, 3).map((a) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
      year: item.issued?.['date-parts']?.[0]?.[0] ?? null,
      venue: item['container-title']?.[0] ?? null,
      citations: item['is-referenced-by-count'] ?? 0,
      doi: item.DOI,
      url: `https://doi.org/${item.DOI}`,
    }));
}
