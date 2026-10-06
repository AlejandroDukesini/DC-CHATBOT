// Agente investigador propio: no usa ningún LLM.
// 1. Analiza la consulta (idioma y palabras clave).
// 2. Busca en Wikipedia y evalúa si el artículo encontrado cubre la consulta; si no, reformula
//    (solo palabras clave, otro idioma) hasta encontrar uno que sí lo haga.
// 3. Si el mejor artículo está en otro idioma, salta a su versión en el idioma del usuario vía Wikidata.
// 4. Contrasta con Wikidata y busca literatura académica revisada en Crossref (DOIs).
// 5. Puntúa todas las frases con TF-IDF y construye un resumen extractivo citando cada fuente.
// Al ser extractivo, nunca inventa: cada frase de la respuesta existe literalmente en una fuente citada.

import { UserError } from '../errors.js';
import { detectLanguage, keywords, queryWords, scoreSentences, similarity, splitSentences, stripAccents, terms } from './text.js';
import { searchCrossref, searchWikipedia, wikidataDescriptions, wikidataSitelink, wikipediaPage } from './sources.js';

export const QUERY_MIN = 2;
export const QUERY_MAX = 200;

export function validateQuery(query) {
  const q = String(query ?? '').replace(/\s+/g, ' ').trim();
  if (q.length < QUERY_MIN) throw new UserError('Escribe un tema para investigar. Ejemplo: `investigar agujero negro`.');
  if (q.length > QUERY_MAX) throw new UserError(`La consulta es demasiado larga (máximo ${QUERY_MAX} caracteres).`);
  return q;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Qué fracción de las palabras clave aparece en el título del artículo. */
function titleCoverage(page, kw) {
  const t = new Set(terms(page.title));
  return kw.filter((k) => t.has(k)).length / kw.length;
}

/** Busca con reformulación hasta encontrar un artículo cuyo título cubra la consulta. */
async function findArticles(fetchFn, query, kw, lang, opts, steps) {
  const plain = queryWords(query).join(' ');
  const other = lang === 'es' ? 'en' : 'es';
  const attempts = [
    { q: query, lang },
    { q: plain, lang },
    { q: plain, lang: other },
  ].filter((a, i, all) => a.q && all.findIndex((b) => b.q === a.q && b.lang === a.lang) === i);

  let best = null;
  for (const attempt of attempts) {
    let pages;
    try {
      pages = await searchWikipedia(fetchFn, attempt.q, attempt.lang, opts);
    } catch {
      steps.push(`Wikipedia (${attempt.lang}) no respondió; pruebo otra estrategia.`);
      continue;
    }
    if (!pages.length) {
      steps.push(`Busqué «${attempt.q}» en Wikipedia (${attempt.lang}) → sin resultados.`);
      continue;
    }
    // El artículo cuyo título mejor cubre la consulta pasa a ser el principal.
    const ranked = pages.map((p, i) => ({ p, i, cov: titleCoverage(p, kw) })).sort((a, b) => b.cov - a.cov || a.i - b.i);
    const candidate = { pages: ranked.map((r) => r.p), coverage: ranked[0].cov };
    steps.push(`Busqué «${attempt.q}» en Wikipedia (${attempt.lang}) → ${pages.length} artículo(s); el mejor, «${candidate.pages[0].title}», cubre el ${Math.round(candidate.coverage * 100)} % de la consulta.`);
    if (!best || candidate.coverage > best.coverage) best = candidate;
    if (best.coverage >= 1) break;
  }
  if (!best) return [];

  // Si el mejor resultado está en otro idioma, se busca su versión en el idioma del usuario.
  const main = best.pages[0];
  if (main.lang !== lang && main.wikidataId) {
    try {
      const title = await wikidataSitelink(fetchFn, main.wikidataId, lang, opts);
      const local = title ? await wikipediaPage(fetchFn, title, lang, opts) : null;
      if (local) {
        steps.push(`Encontré «${main.title}» en ${main.lang}; mediante Wikidata salté a su versión en ${lang}: «${local.title}».`);
        return [local, ...best.pages.slice(1).filter((p) => p.lang === lang)];
      }
    } catch {
      // Si falla, se usa el artículo en el otro idioma.
    }
  }
  return best.pages;
}

export async function research(rawQuery, { fetch: fetchFn = globalThis.fetch, contactEmail, maxSentences = 4, timeoutMs = 6000 } = {}) {
  const query = validateQuery(rawQuery);
  const opts = { contactEmail, timeoutMs };
  const lang = detectLanguage(query);
  const kw = keywords(query);
  if (!kw.length) throw new UserError('La consulta es demasiado genérica. Añade el tema concreto que quieres investigar.');

  const steps = [`Analicé la consulta → idioma «${lang}», palabras clave: ${queryWords(query).join(', ')}.`];
  const pages = await findArticles(fetchFn, query, kw, lang, opts, steps);

  // Contraste con datos estructurados (Wikidata).
  let wikidata = {};
  if (pages.length) {
    try {
      wikidata = await wikidataDescriptions(fetchFn, pages.map((p) => p.wikidataId).filter(Boolean), pages[0].lang, opts);
      const top = wikidata[pages[0].wikidataId];
      steps.push(top ? `Contrasté «${pages[0].title}» con Wikidata (${top.id}): «${top.description}».` : 'Wikidata no tiene una descripción para el artículo principal.');
    } catch {
      steps.push('Wikidata no respondió; la respuesta no está contrastada con datos estructurados.');
    }
  }

  // Literatura académica: la mayoría está en inglés, así que se usa la etiqueta inglesa de Wikidata si existe.
  const academicQuery = wikidata[pages[0]?.wikidataId]?.labelEn ?? queryWords(query).join(' ');
  const academicTerms = terms(academicQuery);
  let references = [];
  try {
    references = (await searchCrossref(fetchFn, academicQuery, opts)).filter((r) => {
      const title = new Set(terms(stripAccents(r.title)));
      return academicTerms.every((t) => title.has(t));
    }).sort((a, b) => b.citations - a.citations).slice(0, 3);
    steps.push(`Busqué «${academicQuery}» en Crossref (registro oficial de DOIs) → ${references.length} artículo(s) académico(s) relevantes.`);
  } catch {
    steps.push('Crossref no respondió a tiempo; continúo sin referencias académicas.');
  }

  if (!pages.length) {
    return { query, language: lang, answer: null, highlights: [], sources: [], references, steps, confidence: 0, confidenceLabel: 'sin datos' };
  }

  // Resumen extractivo.
  const candidates = pages.flatMap((page, source) => splitSentences(page.text).map((text, pos) => ({ text, source, pos })));
  const scores = scoreSentences(candidates.map((c) => c.text), kw);
  candidates.forEach((c, i) => {
    c.matched = scores[i].matched;
    c.score = scores[i].score + (c.pos === 0 ? 0.15 : 0) + (c.source === 0 ? 0.1 : 0);
  });

  const selected = [];
  const definition = candidates.find((c) => c.source === 0 && c.pos === 0);
  if (definition) selected.push(definition);
  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    if (selected.length >= maxSentences) break;
    if (!c.matched.length || selected.includes(c)) continue;
    if (selected.some((s) => similarity(s.text, c.text) > 0.5)) continue;
    selected.push(c);
  }
  selected.sort((a, b) => (a === definition ? -1 : b === definition ? 1 : a.source - b.source || a.pos - b.pos));
  steps.push(`Puntué ${candidates.length} frases con TF-IDF y seleccioné las ${selected.length} más relevantes.`);

  const usedSources = [...new Set(selected.map((s) => s.source))];
  const sources = usedSources.map((i) => {
    const page = pages[i];
    const wd = page.wikidataId ? wikidata[page.wikidataId] : null;
    return {
      title: page.title,
      url: page.url,
      type: `Wikipedia (${page.lang})`,
      verification: wd ? `Contrastado con Wikidata ${wd.id}` : 'Sin contraste en Wikidata',
    };
  });

  const covered = new Set(selected.flatMap((s) => s.matched));
  const coverage = covered.size / kw.length;
  const titleCov = titleCoverage(pages[0], kw);
  const topVerified = Boolean(wikidata[pages[0].wikidataId]);
  const confidence = clamp(
    0.15 + 0.3 * coverage + 0.25 * titleCov + (usedSources.length >= 2 ? 0.1 : 0) + (topVerified ? 0.1 : 0) + (references.length ? 0.05 : 0),
    0,
    0.95,
  );

  return {
    query,
    language: lang,
    answer: selected.map((s) => s.text).join(' '),
    highlights: selected.map((s) => ({ text: s.text, source: usedSources.indexOf(s.source) })),
    sources,
    references,
    steps,
    confidence,
    confidenceLabel: confidence >= 0.7 ? 'alta' : confidence >= 0.45 ? 'media' : 'baja',
  };
}
